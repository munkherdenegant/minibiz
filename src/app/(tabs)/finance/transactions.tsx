import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet } from 'react-native';

import { ChoiceChips, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useActiveBusiness } from '@/features/business/hooks';
import { TransactionRow } from '@/features/finance/components/transaction-row';
import { useCashTransactions, useVoidCashTransaction } from '@/features/finance/hooks';
import { SALE_RANGES, rangeStart, type SaleRange } from '@/features/sales/ranges';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import type { CashTransactionWithCategory } from '@/types/models';

const rangeOptions = SALE_RANGES.map((value) => ({ value, label: mn.sales.ranges[value] }));
const f = mn.finance;

export default function TransactionsScreen() {
  const currency = useActiveBusiness()?.currency ?? 'MNT';
  const [range, setRange] = useState<SaleRange>('month');
  const transactions = useCashTransactions(rangeStart(range));
  const voidTransaction = useVoidCashTransaction();
  const items = transactions.data?.pages.flat() ?? [];

  function confirmVoid(transaction: CashTransactionWithCategory) {
    Alert.alert(f.voidConfirmTitle, f.voidConfirmText, [
      { text: mn.common.cancel, style: 'cancel' },
      {
        text: f.void,
        style: 'destructive',
        onPress: () =>
          voidTransaction.mutate(transaction.id, {
            onError: (error) => Alert.alert(getErrorMessage(error)),
          }),
      },
    ]);
  }

  function renderEmpty() {
    if (transactions.isPending) return <LoadingState />;
    if (transactions.isError) {
      return (
        <ErrorState
          message={getErrorMessage(transactions.error)}
          onRetry={() => transactions.refetch()}
        />
      );
    }
    return (
      <EmptyState
        icon="finance"
        title={range === 'all' ? f.emptyTitle : f.emptyRange}
        description={range === 'all' ? f.emptyText : undefined}
        actionLabel={f.add}
        onAction={() => router.push('/finance/new')}
      />
    );
  }

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: f.transactions }} />
      <ChoiceChips
        label={mn.sales.ranges.all}
        hideLabel
        options={rangeOptions}
        value={range}
        onChange={setRange}
      />
      <FlatList
        data={items}
        keyExtractor={(transaction) => transaction.id}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            currency={currency}
            // Only active expenses and income can be voided here.
            onPress={
              item.voided_at === null && item.kind !== 'inventory_purchase'
                ? () => confirmVoid(item)
                : undefined
            }
          />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty()}
        ListFooterComponent={
          transactions.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined
        }
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) {
            transactions.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshing={transactions.isRefetching && !transactions.isFetchingNextPage}
        onRefresh={() => transactions.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, marginHorizontal: -spacing.lg },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
