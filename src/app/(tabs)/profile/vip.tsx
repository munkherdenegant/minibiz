import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  Message,
  MoneyText,
  Screen,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useActiveBusiness } from '@/features/business/hooks';
import { isVipActive, useBuyVip, useVipPlans } from '@/features/vip/hooks';
import { formatDate } from '@/i18n/format';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import type { VipPlan } from '@/types/models';

const v = mn.vip;

export default function VipScreen() {
  const business = useActiveBusiness();
  const plans = useVipPlans();
  const buyVip = useBuyVip();
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(
    null,
  );

  const active = isVipActive(business);

  async function buy(plan: VipPlan) {
    if (!business) return;
    setResult(null);
    setBuyingPlan(plan.id);
    try {
      const payment = await buyVip.mutateAsync({ businessId: business.id, planId: plan.id });
      if (payment.status === 'succeeded') {
        setResult({
          tone: 'success',
          text: v.paid(payment.vip_until ? formatDate(payment.vip_until) : ''),
        });
      } else if (payment.status === 'pending') {
        setResult({ tone: 'info', text: v.pending });
      } else {
        setResult({ tone: 'error', text: v.notPaid });
      }
    } catch (e) {
      const wireCode = (e as { wireCode?: string | null }).wireCode;
      setResult({
        tone: 'error',
        text: wireCode ? `${getErrorMessage(e)}\n(Wire: ${wireCode})` : getErrorMessage(e),
      });
    } finally {
      setBuyingPlan(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: v.title }} />

      <Card style={styles.status}>
        <View style={styles.statusIcon}>
          <Icon name="star" size={28} color={active ? colors.warning : colors.muted} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">{active ? v.active : v.inactive}</AppText>
          <AppText tone="muted">
            {active && business?.vip_until ? v.until(formatDate(business.vip_until)) : v.pitch}
          </AppText>
        </View>
        {active ? <Badge label="VIP" tone="warning" /> : null}
      </Card>

      <Message tone={result?.tone ?? 'info'} text={result?.text ?? null} />

      {plans.isPending ? (
        <LoadingState />
      ) : plans.isError ? (
        <ErrorState message={getErrorMessage(plans.error)} onRetry={() => plans.refetch()} />
      ) : (
        plans.data.map((plan) => (
          <Card key={plan.id} style={styles.plan}>
            <AppText variant="subheading">{plan.name}</AppText>
            <MoneyText amount={plan.price} currency="MNT" variant="title" />
            <AppText tone="muted">{v.duration(plan.duration_days)}</AppText>
            <Button
              title={active ? v.extend : v.buy}
              icon="star"
              loading={buyingPlan === plan.id}
              disabled={buyingPlan !== null && buyingPlan !== plan.id}
              onPress={() => buy(plan)}
            />
          </Card>
        ))
      )}

      <AppText variant="caption" tone="muted">
        {v.wireNote}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  plan: { gap: spacing.sm },
});
