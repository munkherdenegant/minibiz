// Row types for tables created in supabase/migrations. Keep in sync with the migrations
// (to be replaced by generated types from `npx supabase gen types` once the CLI is linked).

export const BUSINESS_TYPES = [
  'retail',
  'clothing_cosmetics',
  'online_seller',
  'home_business',
  'market_stall',
  'wholesale',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const CURRENCIES = ['MNT', 'USD', 'CNY'] as const;

export type Currency = (typeof CURRENCIES)[number];

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  locale: 'mn' | 'en';
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  name: string;
  business_type: BusinessType;
  currency: string;
  logo_path: string | null;
  timezone: string;
  allow_negative_stock: boolean;
  next_sale_number: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack'] as const;

export type Unit = (typeof UNITS)[number];

export type Product = {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: Unit;
  image_path: string | null;
  cost_price: number;
  /** System-maintained moving average cost. */
  avg_cost: number;
  selling_price: number;
  /** System-maintained; changes only through inventory movements. */
  current_stock: number;
  low_stock_threshold: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryTransactionType =
  | 'opening_stock'
  | 'purchase_receipt'
  | 'sale'
  | 'sale_cancellation'
  | 'customer_return'
  | 'damage'
  | 'adjustment';

export type InventoryTransaction = {
  id: string;
  business_id: string;
  product_id: string;
  type: InventoryTransactionType;
  quantity_change: number;
  unit_cost: number;
  stock_after: number;
  reference: string | null;
  note: string | null;
  occurred_at: string;
  created_by: string;
  created_at: string;
};

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'other'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type SaleStatus = 'completed' | 'cancelled';

export type Sale = {
  id: string;
  business_id: string;
  sale_number: number;
  client_request_id: string;
  status: SaleStatus;
  sold_at: string;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  /** Cost of goods sold, from average-cost snapshots. */
  total_cost: number;
  amount_paid: number;
  /** Generated: total_amount − amount_paid. */
  balance_due: number;
  note: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SaleItem = {
  id: string;
  business_id: string;
  sale_id: string;
  product_id: string;
  /** Snapshots taken when the sale was made. */
  product_name: string;
  unit: Unit;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  line_cost: number;
  created_at: string;
};

export type SalePayment = {
  id: string;
  business_id: string;
  sale_id: string;
  /** Negative for refunds. */
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  created_by: string;
  created_at: string;
};

export type SaleWithDetails = Sale & { sale_items: SaleItem[]; sale_payments: SalePayment[] };

export const CASH_KINDS = ['expense', 'income'] as const;

/** Kinds the user records; `inventory_purchase` is created by stock receipts. */
export type CashKind = (typeof CASH_KINDS)[number];

export type CashCategory = {
  id: string;
  business_id: string;
  kind: CashKind;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CashTransaction = {
  id: string;
  business_id: string;
  kind: CashKind | 'inventory_purchase';
  category_id: string | null;
  amount: number;
  method: PaymentMethod;
  occurred_at: string;
  description: string | null;
  inventory_transaction_id: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CashTransactionWithCategory = CashTransaction & {
  cash_categories: Pick<CashCategory, 'name'> | null;
};

/** Returned by get_financial_summary (docs/architecture.md, section 5.3). */
export type FinancialSummary = {
  sales_count: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  inventory_losses: number;
  other_income: number;
  net_profit: number;
  cash_received: number;
  cash_paid: number;
  net_cash_flow: number;
  outstanding_balances: number;
  inventory_value: number;
};

export type LowStockProduct = Pick<
  Product,
  'id' | 'name' | 'unit' | 'current_stock' | 'low_stock_threshold'
>;

/** Returned by get_dashboard. */
export type Dashboard = {
  today: FinancialSummary;
  active_products: number;
  low_stock_count: number;
  low_stock: LowStockProduct[];
  recent_sales: Sale[];
};
