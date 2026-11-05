import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  ChoiceChips,
  ErrorState,
  Icon,
  LoadingState,
  Screen,
} from '@/components/ui';
import { colors, spacing, touchTarget } from '@/constants/theme';
import { useActiveBusiness } from '@/features/business/hooks';
import { SummaryCard } from '@/features/finance/components/summary-card';
import { useFinancialSummary } from '@/features/finance/hooks';
import { SALE_RANGES, rangeStart, type SaleRange } from '@/features/sales/ranges';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import type { FinancialSummary } from '@/types/models';

const rangeOptions = SALE_RANGES.map((value) => ({ value, label: mn.sales.ranges[value] }));
const f = mn.finance;

function openNewEntry() {
  router.push('/finance/new');
}

export default function FinanceScreen() {
  const currency = useActiveBusiness()?.currency ?? 'MNT';
  const [range, setRange] = useState<SaleRange>('month');
  const summary = useFinancialSummary(rangeStart(range));

  return (
    <Screen
      refreshing={summary.isRefetching}
      onRefresh={summary.isSuccess ? () => summary.refetch() : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={f.add}
              hitSlop={8}
              onPress={openNewEntry}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Icon name="add" color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ChoiceChips
        label={mn.sales.ranges.all}
        hideLabel
        options={rangeOptions}
        value={range}
        onChange={setRange}
      />

      {summary.isPending ? (
        <LoadingState />
      ) : summary.isError ? (
        <ErrorState message={getErrorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : (
        <SummaryContent summary={summary.data} currency={currency} />
      )}

      <View style={styles.actions}>
        <Button title={f.newExpense} icon="expense" onPress={openNewEntry} />
        <Button
          title={f.transactions}
          icon="list"
          variant="secondary"
          onPress={() => router.push('/finance/transactions')}
        />
      </View>
    </Screen>
  );
}

function SummaryContent({ summary, currency }: { summary: FinancialSummary; currency: string }) {
  return (
    <>
      <SummaryCard
        title={f.profitSection}
        currency={currency}
        lines={[
          { label: f.revenue, amount: summary.revenue },
          { label: f.cogs, amount: -summary.cogs },
          { label: f.grossProfit, amount: summary.gross_profit, total: true },
          { label: f.operatingExpenses, amount: -summary.operating_expenses },
          { label: f.inventoryLosses, amount: -summary.inventory_losses },
          { label: f.otherIncome, amount: summary.other_income },
          { label: f.netProfit, amount: summary.net_profit, total: true },
        ]}
      />
      <SummaryCard
        title={f.cashSection}
        currency={currency}
        lines={[
          { label: f.cashReceived, amount: summary.cash_received },
          { label: f.cashPaid, amount: -summary.cash_paid },
          { label: f.netCashFlow, amount: summary.net_cash_flow, total: true },
        ]}
      />
      <SummaryCard
        title={f.nowSection}
        currency={currency}
        lines={[
          { label: f.outstanding, amount: summary.outstanding_balances },
          { label: f.inventoryValue, amount: summary.inventory_value },
        ]}
      />
      <AppText variant="caption" tone="muted">
        {f.disclaimer}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  actions: { gap: spacing.sm },
});
