import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormTextField } from '@/components/form/form-text-field';
import {
  Button,
  ChoiceChips,
  ErrorState,
  LoadingState,
  Message,
  Screen,
} from '@/components/ui';
import { useActiveBusiness } from '@/features/business/hooks';
import { useCashCategories, useCreateCashTransaction } from '@/features/finance/hooks';
import {
  cashTransactionSchema,
  type CashTransactionFormValues,
  type CashTransactionInput,
} from '@/features/finance/schemas';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';
import { CASH_KINDS, PAYMENT_METHODS, type CashKind } from '@/types/models';

const f = mn.finance;
const kindOptions = CASH_KINDS.map((value) => ({ value, label: f.kinds[value] }));
const methodOptions = PAYMENT_METHODS.map((value) => ({ value, label: mn.sales.methods[value] }));

export default function NewCashTransactionScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const initialKind: CashKind = kind === 'income' ? 'income' : 'expense';
  const business = useActiveBusiness();
  const categories = useCashCategories();
  const createTransaction = useCreateCashTransaction();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<CashTransactionFormValues, unknown, CashTransactionInput>({
    resolver: zodResolver(cashTransactionSchema),
    defaultValues: {
      kind: initialKind,
      amount: '',
      categoryId: '',
      method: 'cash',
      description: '',
    },
  });

  const selectedKind = useWatch({ control, name: 'kind' });
  const categoryOptions = (categories.data ?? [])
    .filter((category) => category.kind === selectedKind)
    .map((category) => ({ value: category.id, label: category.name }));

  const submit = handleSubmit(async (values) => {
    if (!business) return;
    setError(null);
    try {
      await createTransaction.mutateAsync({ businessId: business.id, ...values });
      goBack('/finance');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  });

  const title = selectedKind === 'income' ? f.newIncome : f.newExpense;

  if (categories.isPending) return <LoadingState />;
  if (categories.isError) {
    return (
      <ErrorState
        message={getErrorMessage(categories.error)}
        onRetry={() => categories.refetch()}
      />
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <ChoiceChips
            label={f.kind}
            hideLabel
            options={kindOptions}
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              // Categories belong to one kind; the old choice no longer applies.
              setValue('categoryId', '');
            }}
          />
        )}
      />
      <FormTextField
        control={control}
        name="amount"
        label={f.amount}
        keyboardType="decimal-pad"
        autoFocus
      />
      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <ChoiceChips
            label={f.category}
            options={categoryOptions}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <ChoiceChips
            label={f.method}
            options={methodOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <FormTextField
        control={control}
        name="description"
        label={`${f.description} (${mn.common.optional})`}
        placeholder={f.descriptionPlaceholder}
        maxLength={500}
      />
      <Message tone="error" text={error} />
      <Button title={f.save} loading={isSubmitting} onPress={submit} />
    </Screen>
  );
}
