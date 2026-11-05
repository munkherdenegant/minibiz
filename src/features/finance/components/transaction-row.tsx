import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Icon, MoneyText } from '@/components/ui';
import { colors, radius, spacing, touchTarget } from '@/constants/theme';
import { formatDateTime } from '@/i18n/format';
import { mn } from '@/i18n/mn';
import type { CashTransactionWithCategory } from '@/types/models';

export function TransactionRow({
  transaction,
  currency,
  onPress,
}: {
  transaction: CashTransactionWithCategory;
  currency: string;
  onPress?: () => void;
}) {
  const income = transaction.kind === 'income';
  const voided = transaction.voided_at !== null;
  const title =
    transaction.kind === 'inventory_purchase'
      ? mn.finance.stockPurchase
      : (transaction.cash_categories?.name ?? mn.finance.kinds[transaction.kind]);
  const subtitle = [
    formatDateTime(transaction.occurred_at),
    mn.sales.methods[transaction.method],
    transaction.description,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Icon
        name={income ? 'income' : 'expense'}
        size={24}
        color={voided ? colors.muted : income ? colors.success : colors.error}
      />
      <View style={styles.text}>
        <AppText numberOfLines={1}>{title}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
      <View style={styles.amount}>
        <MoneyText
          amount={income ? transaction.amount : -transaction.amount}
          currency={currency}
          variant="label"
          tone={voided ? 'muted' : income ? 'success' : 'default'}
          style={voided && styles.struck}
        />
        {voided ? <Badge label={mn.finance.voided} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  text: { flex: 1, gap: 2 },
  amount: { alignItems: 'flex-end', gap: spacing.xs },
  struck: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },
});
