// Receives Wire webhook events (https://docs.wire.mn/en/docs/guides/webhooks).
// Deployed without gateway JWT checks; every request must carry a valid WirePayment-Signature.

import { adminClient } from '../_shared/supabase.ts';
import { applyPaymentIntent } from '../_shared/vip.ts';
import { getPaymentIntent, verifyWireSignature } from '../_shared/wire.ts';

type WireEvent = {
  id: string;
  object: 'event';
  type: string;
  created: number;
  data: { id?: string; object?: string };
};

const PAYMENT_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.canceled',
  'payment_intent.payment_failed',
]);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('WIRE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('WIRE_WEBHOOK_SECRET is not set');
    return new Response('Not configured', { status: 500 });
  }

  // Verify against the raw body: parsing first would change the signed bytes.
  const rawBody = await request.text();
  const valid = await verifyWireSignature(
    rawBody,
    request.headers.get('WirePayment-Signature'),
    secret,
  );
  if (!valid) return new Response('Invalid signature', { status: 400 });

  let event: WireEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // The dashboard's verification ping only needs a 2xx.
  if (event.type === 'endpoint.verification') return new Response('ok');

  if (!PAYMENT_EVENTS.has(event.type) || !event.data?.id?.startsWith('pi_')) {
    return new Response('ignored');
  }

  try {
    const admin = adminClient();
    const { data: payment, error } = await admin
      .from('vip_payments')
      .select('id, status')
      .eq('payment_intent_id', event.data.id)
      .maybeSingle();
    if (error) throw error;
    // Not a VIP purchase (e.g. a payment link), or already handled.
    if (!payment || payment.status !== 'pending') return new Response('ok');

    // Re-read the intent from Wire instead of trusting the event payload.
    await applyPaymentIntent(admin, await getPaymentIntent(event.data.id));
    return new Response('ok');
  } catch (error) {
    // A 5xx makes Wire retry the delivery.
    console.error('wire-webhook failed', event.id, error);
    return new Response('Retry later', { status: 500 });
  }
});
