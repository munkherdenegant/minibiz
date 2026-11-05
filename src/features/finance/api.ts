import { supabase } from '@/lib/supabase';
import type {
  CashCategory,
  CashKind,
  CashTransaction,
  CashTransactionWithCategory,
  Dashboard,
  FinancialSummary,
  PaymentMethod,
} from '@/types/models';

export const TRANSACTIONS_PAGE_SIZE = 30;

/** Report figures from `from` (ISO time, `null` = all time) until now. */
export async function fetchFinancialSummary({
  businessId,
  from,
}: {
  businessId: string;
  from: string | null;
}): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    p_business_id: businessId,
    p_from: from,
    p_to: null,
  });
  if (error) throw error;
  return data as FinancialSummary;
}

export async function fetchDashboard(businessId: string): Promise<Dashboard> {
  const { data, error } = await supabase.rpc('get_dashboard', { p_business_id: businessId });
  if (error) throw error;
  return data as Dashboard;
}

export async function fetchCashCategories(businessId: string): Promise<CashCategory[]> {
  const { data, error } = await supabase
    .from('cash_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('kind')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data as CashCategory[];
}

/** One page of expenses and income, newest first, optionally since `from`. */
export async function fetchCashTransactions({
  businessId,
  from,
  page,
}: {
  businessId: string;
  from: string | null;
  page: number;
}): Promise<CashTransactionWithCategory[]> {
  const start = page * TRANSACTIONS_PAGE_SIZE;
  let query = supabase
    .from('cash_transactions')
    .select('*, cash_categories(name)')
    .eq('business_id', businessId)
    .order('occurred_at', { ascending: false })
    .order('id')
    .range(start, start + TRANSACTIONS_PAGE_SIZE - 1);
  if (from) query = query.gte('occurred_at', from);

  const { data, error } = await query;
  if (error) throw error;
  return data as CashTransactionWithCategory[];
}

export type NewCashTransaction = {
  businessId: string;
  kind: CashKind;
  categoryId: string;
  amount: number;
  method: PaymentMethod;
  description: string | null;
};

export async function createCashTransaction(input: NewCashTransaction): Promise<CashTransaction> {
  const { data, error } = await supabase.rpc('create_cash_transaction', {
    p_business_id: input.businessId,
    p_kind: input.kind,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_method: input.method,
    p_occurred_at: null,
    p_description: input.description,
  });
  if (error) throw error;
  return data as CashTransaction;
}

/** Marks a mistaken entry as void; it stays in the list but no longer counts. */
export async function voidCashTransaction(id: string): Promise<CashTransaction> {
  const { data, error } = await supabase.rpc('void_cash_transaction', {
    p_transaction_id: id,
  });
  if (error) throw error;
  return data as CashTransaction;
}
