import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveBusiness } from '@/features/business/hooks';
import { financeKeys } from '@/features/finance/hooks';
import { productKeys } from '@/features/products/hooks';
import {
  SALES_PAGE_SIZE,
  addSalePayment,
  cancelSale,
  createSale,
  fetchSale,
  fetchSales,
} from '@/features/sales/api';
import type { Sale } from '@/types/models';

export const saleKeys = {
  all: (businessId: string | undefined) => ['sales', businessId] as const,
  lists: (businessId: string | undefined) => [...saleKeys.all(businessId), 'list'] as const,
  list: (businessId: string | undefined, from: string | null) =>
    [...saleKeys.lists(businessId), from] as const,
  detail: (businessId: string | undefined, id: string) =>
    [...saleKeys.all(businessId), 'detail', id] as const,
};

/** Sales of the active business since `from` (ISO time, `null` = all), page by page. */
export function useSales(from: string | null) {
  const businessId = useActiveBusiness()?.id;
  return useInfiniteQuery({
    queryKey: saleKeys.list(businessId, from),
    queryFn: ({ pageParam }) => fetchSales({ businessId: businessId!, from, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SALES_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!businessId,
  });
}

export function useSale(id: string) {
  const businessId = useActiveBusiness()?.id;
  return useQuery({
    queryKey: saleKeys.detail(businessId, id),
    queryFn: () => fetchSale(id),
    enabled: !!businessId,
  });
}

/**
 * Sale writes change the sale, its payments, product stock and the finance figures,
 * so refresh all of them (the detail query refetches with its items and payments).
 */
function useSaleMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Sale>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: saleKeys.all(sale.business_id) });
      queryClient.invalidateQueries({ queryKey: productKeys.all(sale.business_id) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(sale.business_id) });
    },
  });
}

export const useCreateSale = () => useSaleMutation(createSale);
export const useAddSalePayment = () => useSaleMutation(addSalePayment);
export const useCancelSale = () => useSaleMutation(cancelSale);
