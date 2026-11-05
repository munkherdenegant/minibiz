import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveBusiness } from '@/features/business/hooks';
import {
  TRANSACTIONS_PAGE_SIZE,
  createCashTransaction,
  fetchCashCategories,
  fetchCashTransactions,
  fetchDashboard,
  fetchFinancialSummary,
  voidCashTransaction,
} from '@/features/finance/api';
import type { CashTransaction } from '@/types/models';

/**
 * Everything under `all` is derived from sales, stock and cash entries, so any of
 * those writes invalidates `financeKeys.all` (see the sales and products hooks).
 */
export const financeKeys = {
  all: (businessId: string | undefined) => ['finance', businessId] as const,
  dashboard: (businessId: string | undefined) =>
    [...financeKeys.all(businessId), 'dashboard'] as const,
  summary: (businessId: string | undefined, from: string | null) =>
    [...financeKeys.all(businessId), 'summary', from] as const,
  transactions: (businessId: string | undefined, from: string | null) =>
    [...financeKeys.all(businessId), 'transactions', from] as const,
  categories: (businessId: string | undefined) => ['cash-categories', businessId] as const,
};

export function useDashboard() {
  const businessId = useActiveBusiness()?.id;
  return useQuery({
    queryKey: financeKeys.dashboard(businessId),
    queryFn: () => fetchDashboard(businessId!),
    enabled: !!businessId,
  });
}

export function useFinancialSummary(from: string | null) {
  const businessId = useActiveBusiness()?.id;
  return useQuery({
    queryKey: financeKeys.summary(businessId, from),
    queryFn: () => fetchFinancialSummary({ businessId: businessId!, from }),
    enabled: !!businessId,
  });
}

export function useCashCategories() {
  const businessId = useActiveBusiness()?.id;
  return useQuery({
    queryKey: financeKeys.categories(businessId),
    queryFn: () => fetchCashCategories(businessId!),
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });
}

export function useCashTransactions(from: string | null) {
  const businessId = useActiveBusiness()?.id;
  return useInfiniteQuery({
    queryKey: financeKeys.transactions(businessId, from),
    queryFn: ({ pageParam }) =>
      fetchCashTransactions({ businessId: businessId!, from, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === TRANSACTIONS_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!businessId,
  });
}

function useCashMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<CashTransaction>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(transaction.business_id) });
    },
  });
}

export const useCreateCashTransaction = () => useCashMutation(createCashTransaction);
export const useVoidCashTransaction = () => useCashMutation(voidCashTransaction);
