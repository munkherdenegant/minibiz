import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { VipPaymentStatus, VipPlan } from '@/types/models';

export async function fetchVipPlans(): Promise<VipPlan[]> {
  const { data, error } = await supabase.from('vip_plans').select('*').order('sort_order');
  if (error) throw error;
  return data as VipPlan[];
}

/**
 * Calls the vip-checkout Edge Function. It answers errors as `{ error: CODE }`;
 * rethrow the code as the message so getErrorMessage can translate it.
 */
async function invokeVipCheckout<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('vip-checkout', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      if (payload && typeof payload.error === 'string') {
        // `wire_code` is Wire's own error code, shown so the problem can be fixed.
        throw Object.assign(new Error(payload.error), { wireCode: payload.wire_code ?? null });
      }
    }
    throw error;
  }
  return data as T;
}

/** Creates (or reuses) a Wire payment page for the plan. */
export function startVipCheckout(input: {
  businessId: string;
  planId: string;
  /** Deep link the hosted page returns to; closes the in-app browser. */
  returnUrl: string;
}) {
  return invokeVipCheckout<{ id: string; url: string }>({
    action: 'create',
    business_id: input.businessId,
    plan_id: input.planId,
    return_url: input.returnUrl,
  });
}

/** Asks the server to re-check the payment with Wire and activate VIP if it was paid. */
export function syncVipPayment(id: string) {
  return invokeVipCheckout<{ id: string; status: VipPaymentStatus; vip_until: string | null }>({
    action: 'sync',
    vip_payment_id: id,
  });
}
