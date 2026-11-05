import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveBusiness } from '@/features/business/hooks';
import { financeKeys } from '@/features/finance/hooks';
import {
  PRODUCTS_PAGE_SIZE,
  createProduct,
  fetchProduct,
  fetchProductMovements,
  fetchProducts,
  removeProductImage,
  updateProduct,
  uploadProductImage,
} from '@/features/products/api';
import type { Product } from '@/types/models';

export const productKeys = {
  all: (businessId: string | undefined) => ['products', businessId] as const,
  lists: (businessId: string | undefined) => [...productKeys.all(businessId), 'list'] as const,
  list: (businessId: string | undefined, filters: { search: string; archived: boolean }) =>
    [...productKeys.lists(businessId), filters] as const,
  detail: (businessId: string | undefined, id: string) =>
    [...productKeys.all(businessId), 'detail', id] as const,
  movements: (businessId: string | undefined, id: string) =>
    [...productKeys.all(businessId), 'movements', id] as const,
};

/** Products of the active business, loaded page by page as the list scrolls. */
export function useProducts(filters: { search: string; archived: boolean }) {
  const businessId = useActiveBusiness()?.id;
  return useInfiniteQuery({
    queryKey: productKeys.list(businessId, filters),
    queryFn: ({ pageParam }) => fetchProducts({ businessId: businessId!, ...filters, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PRODUCTS_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!businessId,
  });
}

export function useProduct(id: string) {
  const businessId = useActiveBusiness()?.id;
  return useQuery({
    queryKey: productKeys.detail(businessId, id),
    queryFn: () => fetchProduct(id),
    enabled: !!businessId,
  });
}

export function useProductMovements(product: Product | undefined) {
  return useQuery({
    queryKey: productKeys.movements(product?.business_id, product?.id ?? ''),
    queryFn: () => fetchProductMovements(product!),
    enabled: !!product,
  });
}

/** Every product write returns the saved row: cache it and refresh the lists. */
function useProductMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Product>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.business_id, product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.lists(product.business_id) });
      // Stock value, product counts and low-stock alerts on Home and Finance.
      queryClient.invalidateQueries({ queryKey: financeKeys.all(product.business_id) });
    },
  });
}

export const useCreateProduct = () => useProductMutation(createProduct);
export const useUpdateProduct = () => useProductMutation(updateProduct);
export const useUploadProductImage = () => useProductMutation(uploadProductImage);
export const useRemoveProductImage = () => useProductMutation(removeProductImage);
