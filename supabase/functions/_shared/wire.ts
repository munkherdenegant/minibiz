// Minimal Wire (wire.mn) client for Edge Functions. Docs: https://docs.wire.mn/en/docs
// The secret key is read from the WIRE_SECRET_KEY function secret and never leaves the server.

const WIRE_API = 'https://api.wire.mn/v1';

export type WirePaymentIntent = {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status:
    | 'requires_payment_method'
    | 'requires_action'
    | 'requires_capture'
    | 'processing'
    | 'succeeded'
    | 'canceled';
  metadata: Record<string, string> | null;
  expires_at: number;
};

export type WireCheckoutSession = {
  id: string;
  object: 'checkout_session';
  payment_intent: string;
  status: string;
  url: string;
};

export class WireError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function secretKey(): string {
  const key = Deno.env.get('WIRE_SECRET_KEY');
  if (!key) throw new Error('WIRE_SECRET_KEY is not set');
  return key;
}

/**
 * Calls the Wire API. Every POST/DELETE needs an Idempotency-Key; pass a value that is
 * stable for the operation so a retry never creates a second payment.
 */
export async function wireRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey()}` };
  if (method === 'POST') {
    if (!options.idempotencyKey) throw new Error('Idempotency-Key is required for POST');
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${WIRE_API}${path}`, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = (json as { error?: { code?: string; message?: string; request_id?: string } })
      .error;
    console.error('Wire API error', response.status, error?.code, error?.request_id);
    throw new WireError(response.status, error?.code, error?.message ?? 'Wire request failed');
  }
  return json as T;
}

export function getPaymentIntent(id: string) {
  return wireRequest<WirePaymentIntent>('GET', `/payment_intents/${encodeURIComponent(id)}`);
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the `WirePayment-Signature: t=<unix>,v1=<hex>` header: HMAC-SHA256 of
 * `${t}.${rawBody}` with the whsec_ secret, within a 300-second tolerance.
 */
export async function verifyWireSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = new Map(
    header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    }),
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = toHex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)),
  );
  return constantTimeEqual(expected, signature.toLowerCase());
}
