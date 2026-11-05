import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { WirePaymentIntent } from './wire.ts';

/**
 * Brings a vip_payments row in line with the PaymentIntent fetched from Wire. Used by both
 * the webhook and the app's status check; activate_vip makes the activation happen once.
 * Always pass an intent fetched from the Wire API, never one taken from a request body.
 */
export async function applyPaymentIntent(admin: SupabaseClient, intent: WirePaymentIntent) {
  if (intent.status === 'succeeded') {
    if (intent.currency !== 'MNT') throw new Error(`Unexpected currency ${intent.currency}`);
    const { error } = await admin.rpc('activate_vip', {
      p_payment_intent_id: intent.id,
      p_amount: intent.amount,
    });
    if (error) throw error;
    return;
  }

  if (intent.status === 'canceled') {
    const { error } = await admin
      .from('vip_payments')
      .update({ status: 'canceled' })
      .eq('payment_intent_id', intent.id)
      .eq('status', 'pending');
    if (error) throw error;
  }
}
