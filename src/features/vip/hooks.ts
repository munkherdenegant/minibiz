import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import { businessesQueryKey } from '@/features/business/hooks';
import { fetchVipPlans, startVipCheckout, syncVipPayment } from '@/features/vip/api';
import { useAuth } from '@/lib/auth';
import type { Business } from '@/types/models';

export function isVipActive(business: Pick<Business, 'vip_until'> | undefined, now = new Date()) {
  return !!business?.vip_until && new Date(business.vip_until) > now;
}

export function useVipPlans() {
  return useQuery({ queryKey: ['vip-plans'], queryFn: fetchVipPlans, staleTime: 10 * 60_000 });
}

/**
 * Opens Wire's hosted payment page in an in-app browser, waits until the buyer comes back
 * (or closes it), then asks the server for the result. Resolves with the payment status.
 */
export function useBuyVip() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ businessId, planId }: { businessId: string; planId: string }) => {
      const returnUrl = Linking.createURL('vip-return');
      const checkout = await startVipCheckout({ businessId, planId, returnUrl });
      // Loaded on demand so a build without this native module still starts.
      const WebBrowser = await import('expo-web-browser');
      await WebBrowser.openAuthSessionAsync(checkout.url, returnUrl);
      return syncVipPayment(checkout.id);
    },
    onSettled: () => {
      // vip_until lives on the business row.
      queryClient.invalidateQueries({ queryKey: businessesQueryKey(session?.user.id) });
    },
  });
}
