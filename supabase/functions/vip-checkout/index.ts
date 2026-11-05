// Starts a VIP purchase through Wire hosted checkout, or re-checks one after the buyer returns.
//
// POST { action: 'create', business_id, plan_id, return_url } -> { id, url }
// POST { action: 'sync', vip_payment_id }                     -> { id, status, vip_until }

import { adminClient, errorResponse, json, userClient } from '../_shared/supabase.ts';
import { applyPaymentIntent } from '../_shared/vip.ts';
import {
  WireError,
  getPaymentIntent,
  wireRequest,
  type WireCheckoutSession,
  type WirePaymentIntent,
} from '../_shared/wire.ts';

// Wire cancels unpaid intents after 10 minutes; reuse a pending one only while it is fresh.
const REUSE_WINDOW_MS = 8 * 60 * 1000;

// Where the hosted page may send the buyer back: the app's own deep-link schemes only.
const RETURN_URL_PATTERN = /^(ashi|exp|exps):\/\/[^\s]*$/;

/** Maps Wire error codes (docs.wire.mn/en/docs/concepts/errors) to codes the app translates. */
function wireErrorCode(error: WireError): string {
  switch (error.code) {
    case 'connector_required':
    case 'settlement_account_required':
    case 'dan_verification_required':
      return 'WIRE_ACCOUNT_NOT_READY';
    case 'api_key_missing':
    case 'api_key_invalid':
    case 'test_mode_unavailable':
      return 'WIRE_KEY_INVALID';
    default:
      return 'WIRE_UNAVAILABLE';
  }
}

type Body =
  | { action: 'create'; business_id?: string; plan_id?: string; return_url?: string }
  | { action: 'sync'; vip_payment_id?: string };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 405);

  const caller = await userClient(request);
  if (!caller) return errorResponse('NOT_AUTHENTICATED', 401);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_REQUEST');
  }

  try {
    if (body.action === 'create') return await create(caller, body);
    if (body.action === 'sync') return await sync(caller, body);
    return errorResponse('INVALID_REQUEST');
  } catch (error) {
    console.error('vip-checkout failed', error);
    if (error instanceof WireError) {
      // Wire's code is not secret; returning it lets the app say what to fix.
      return json({ error: wireErrorCode(error), wire_code: error.code ?? null }, 502);
    }
    return errorResponse('INTERNAL', 500);
  }
});

type Caller = NonNullable<Awaited<ReturnType<typeof userClient>>>;

async function create(
  caller: Caller,
  body: Extract<Body, { action: 'create' }>,
): Promise<Response> {
  const { business_id: businessId, plan_id: planId, return_url: returnUrl } = body;
  if (!businessId || !planId || !returnUrl || !RETURN_URL_PATTERN.test(returnUrl)) {
    return errorResponse('INVALID_REQUEST');
  }

  // Only the owner of the business may buy for it (checked as the caller, under RLS).
  const { data: isOwner, error: roleError } = await caller.client.rpc('has_business_role', {
    p_business_id: businessId,
    p_roles: ['owner'],
  });
  if (roleError) throw roleError;
  if (!isOwner) return errorResponse('FORBIDDEN', 403);

  const admin = adminClient();
  const { data: plan, error: planError } = await admin
    .from('vip_plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return errorResponse('VIP_PLAN_NOT_FOUND', 404);

  // A second tap while the first page is still payable returns the same page.
  const { data: pending, error: pendingError } = await admin
    .from('vip_payments')
    .select('id, checkout_url, created_at')
    .eq('business_id', businessId)
    .eq('plan_id', planId)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - REUSE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (pending) return json({ id: pending.id, url: pending.checkout_url });

  const paymentId = crypto.randomUUID();
  const intent = await wireRequest<WirePaymentIntent>('POST', '/payment_intents', {
    idempotencyKey: `ashi-vip-${paymentId}`,
    body: {
      amount: plan.price,
      currency: 'MNT',
      description: `Ashi ${plan.name}`,
      metadata: { vip_payment_id: paymentId, business_id: businessId, plan_id: plan.id },
    },
  });

  const returnTo = `${Deno.env.get('SUPABASE_URL')}/functions/v1/wire-return?to=${encodeURIComponent(returnUrl)}`;
  const session = await wireRequest<WireCheckoutSession>('POST', '/checkout/sessions', {
    idempotencyKey: `ashi-vip-${paymentId}-checkout`,
    body: { payment_intent: intent.id, success_url: returnTo, cancel_url: returnTo },
  });

  const { error: insertError } = await admin.from('vip_payments').insert({
    id: paymentId,
    business_id: businessId,
    plan_id: plan.id,
    amount: plan.price,
    duration_days: plan.duration_days,
    payment_intent_id: intent.id,
    checkout_url: session.url,
    created_by: caller.userId,
  });
  if (insertError) throw insertError;

  return json({ id: paymentId, url: session.url });
}

async function sync(caller: Caller, body: Extract<Body, { action: 'sync' }>): Promise<Response> {
  if (!body.vip_payment_id) return errorResponse('INVALID_REQUEST');

  // Read as the caller first: RLS proves they belong to the business.
  const { data: visible, error: visibleError } = await caller.client
    .from('vip_payments')
    .select('id')
    .eq('id', body.vip_payment_id)
    .maybeSingle();
  if (visibleError) throw visibleError;
  if (!visible) return errorResponse('VIP_PAYMENT_NOT_FOUND', 404);

  const admin = adminClient();
  const { data: payment, error } = await admin
    .from('vip_payments')
    .select('*')
    .eq('id', body.vip_payment_id)
    .single();
  if (error) throw error;

  if (payment.status === 'pending') {
    await applyPaymentIntent(admin, await getPaymentIntent(payment.payment_intent_id));
  }

  const { data: updated, error: updatedError } = await admin
    .from('vip_payments')
    .select('id, status, vip_until')
    .eq('id', payment.id)
    .single();
  if (updatedError) throw updatedError;
  return json(updated);
}
