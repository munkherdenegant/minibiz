import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  type IconName,
  ListItem,
  LoadingState,
  MoneyText,
  Screen,
} from '@/components/ui';
import { colors, radius, spacing, touchTarget } from '@/constants/theme';
import { useActiveBusiness } from '@/features/business/hooks';
import { useDashboard } from '@/features/finance/hooks';
import { formatStock } from '@/features/products/format';
import { SaleRow } from '@/features/sales/components/sale-row';
import { formatDayLong } from '@/i18n/format';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import type { Dashboard } from '@/types/models';

const h = mn.home;

const quickActions: { label: string; icon: IconName; href: '/products/new' | '/sales/new' | '/finance/new' }[] = [
  { label: h.recordSale, icon: 'sales', href: '/sales/new' },
  { label: h.addProduct, icon: 'products', href: '/products/new' },
  { label: h.recordExpense, icon: 'expense', href: '/finance/new' },
];

export default function HomeScreen() {
  const business = useActiveBusiness();
  const dashboard = useDashboard();

  return (
    <Screen
      edges={['top']}
      refreshing={dashboard.isRefetching}
      onRefresh={dashboard.isSuccess ? () => dashboard.refetch() : undefined}>
      <View>
        <AppText variant="caption" tone="muted">
          {formatDayLong(new Date())}
        </AppText>
        <AppText variant="title">{business?.name ?? h.greeting}</AppText>
      </View>

      {dashboard.isPending ? (
        <LoadingState />
      ) : dashboard.isError ? (
        <ErrorState
          message={getErrorMessage(dashboard.error)}
          onRetry={() => dashboard.refetch()}
        />
      ) : (
        <DashboardContent dashboard={dashboard.data} currency={business?.currency ?? 'MNT'} />
      )}
    </Screen>
  );
}

function DashboardContent({ dashboard, currency }: { dashboard: Dashboard; currency: string }) {
  const { today } = dashboard;

  if (dashboard.active_products === 0 && dashboard.recent_sales.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="store"
          title={h.welcomeTitle}
          description={h.welcomeText}
          actionLabel={h.addProduct}
          onAction={() => router.push('/products/new')}
        />
      </Card>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          {h.today}
        </AppText>
        <View style={styles.grid}>
          <StatTile
            label={h.salesToday}
            amount={today.revenue}
            caption={h.salesCount(today.sales_count)}
            currency={currency}
          />
          <StatTile label={h.expensesToday} amount={today.operating_expenses} currency={currency} />
          <StatTile label={h.grossProfit} amount={today.gross_profit} currency={currency} signed />
          <StatTile label={h.netProfit} amount={today.net_profit} currency={currency} signed />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          {h.quickActions}
        </AppText>
        <View style={styles.actions}>
          {quickActions.map((action) => (
            <Pressable
              key={action.href}
              accessibilityRole="button"
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Icon name={action.icon} color={colors.primary} />
              <AppText variant="label" tone="primary" numberOfLines={1}>
                {action.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          {h.products}
        </AppText>
        <Card style={styles.list}>
          <ListItem
            title={h.activeProducts}
            value={String(dashboard.active_products)}
            onPress={() => router.push('/products')}
          />
          <Divider />
          <View style={styles.lowStockHeader}>
            <AppText style={styles.flex}>{h.lowStock}</AppText>
            <Badge
              label={String(dashboard.low_stock_count)}
              tone={dashboard.low_stock_count > 0 ? 'warning' : 'neutral'}
            />
          </View>
          {dashboard.low_stock.map((product) => (
            <Fragment key={product.id}>
              <Divider />
              <ListItem
                title={product.name}
                subtitle={h.lowStockLeft(formatStock(product.current_stock, product.unit))}
                onPress={() =>
                  router.push({ pathname: '/products/[id]', params: { id: product.id } })
                }
              />
            </Fragment>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="label" tone="muted" style={styles.flex}>
            {h.recentSales}
          </AppText>
          {dashboard.recent_sales.length > 0 ? (
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/sales')}>
              <AppText variant="label" tone="primary">
                {h.seeAll}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {dashboard.recent_sales.length === 0 ? (
          <Card>
            <AppText tone="muted">{h.noSalesYet}</AppText>
          </Card>
        ) : (
          dashboard.recent_sales.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              currency={currency}
              onPress={() => router.push({ pathname: '/sales/[id]', params: { id: sale.id } })}
            />
          ))
        )}
      </View>
    </>
  );
}

function StatTile({
  label,
  amount,
  caption,
  currency,
  signed = false,
}: {
  label: string;
  amount: number;
  caption?: string;
  currency: string;
  /** Profit figures turn red when negative. */
  signed?: boolean;
}) {
  return (
    <Card style={styles.tile}>
      <AppText variant="caption" tone="muted" numberOfLines={2}>
        {label}
      </AppText>
      <MoneyText
        amount={amount}
        currency={currency}
        variant="heading"
        tone={signed && amount < 0 ? 'error' : 'default'}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      {caption ? (
        <AppText variant="caption" tone="muted">
          {caption}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, gap: spacing.xs, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: touchTarget + 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.6 },
  list: { paddingVertical: spacing.xs },
  lowStockHeader: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
