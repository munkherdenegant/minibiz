import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Divider, MoneyText } from '@/components/ui';
import { spacing } from '@/constants/theme';

export type SummaryLine = {
  label: string;
  amount: number;
  /** Totals are bold and coloured by sign. */
  total?: boolean;
};

/** A titled card of label/amount lines, e.g. the profit breakdown. */
export function SummaryCard({
  title,
  lines,
  currency,
}: {
  title: string;
  lines: SummaryLine[];
  currency: string;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted">
        {title}
      </AppText>
      <Card style={styles.card}>
        {lines.map((line, index) => (
          <Fragment key={line.label}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <AppText variant={line.total ? 'label' : 'body'} style={styles.label}>
                {line.label}
              </AppText>
              <MoneyText
                amount={line.amount}
                currency={currency}
                variant={line.total ? 'subheading' : 'body'}
                tone={line.total ? (line.amount < 0 ? 'error' : 'success') : 'default'}
              />
            </View>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { paddingVertical: spacing.xs },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1 },
});
