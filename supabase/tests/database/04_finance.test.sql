-- Finance: default categories, expenses and income, voiding, summary, dashboard and RLS.
-- Run against the development project: npx supabase test db --linked
-- Everything runs in one transaction and is rolled back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-a000-0000000000f1', 'finance-a@ashi.test'),
  ('00000000-0000-4000-a000-0000000000f2', 'finance-b@ashi.test');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-0000000000f1", "role": "authenticated"}';

select public.create_business('Finance Shop A', 'retail');
-- Water: price 1500, cost 900, 10 in stock.
select public.create_product((select id from public.businesses), 'Water', 1500, 900, 'pcs', 10, 'W');

select is(
  (select count(*)::int from public.cash_categories),
  7,
  'A new business gets the 7 default categories'
);

-- 3 × 1500 = 4500 revenue, 2700 cost, 4000 paid now.
select public.create_sale(
  (select id from public.businesses),
  '00000000-0000-4000-b000-0000000000f1',
  jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'W'), 'quantity', 3)
  ),
  0, 4000, 'cash'
);

-------------------------------------------------------------------------------
-- create_cash_transaction
-------------------------------------------------------------------------------

select lives_ok(
  $$ select public.create_cash_transaction(
       (select id from public.businesses), 'expense',
       (select id from public.cash_categories where name = 'Түрээс'), 1000, 'cash', null, 'Rent'
     ) $$,
  'An expense can be recorded'
);

select lives_ok(
  $$ select public.create_cash_transaction(
       (select id from public.businesses), 'income',
       (select id from public.cash_categories where name = 'Бусад орлого'), 300, 'bank_transfer'
     ) $$,
  'Other income can be recorded'
);

select throws_ok(
  $$ select public.create_cash_transaction(
       (select id from public.businesses), 'income',
       (select id from public.cash_categories where name = 'Түрээс'), 300
     ) $$,
  '22023',
  'CATEGORY_NOT_FOUND',
  'An expense category cannot be used for income'
);

select throws_ok(
  $$ select public.create_cash_transaction(
       (select id from public.businesses), 'expense',
       (select id from public.cash_categories where name = 'Түрээс'), 0
     ) $$,
  '22023',
  'INVALID_AMOUNT',
  'The amount must be positive'
);

select throws_ok(
  $$ insert into public.cash_transactions (business_id, kind, category_id, amount, created_by)
     values (
       (select id from public.businesses), 'expense',
       (select id from public.cash_categories where name = 'Түрээс'), 5,
       '00000000-0000-4000-a000-0000000000f1'
     ) $$,
  '42501',
  null,
  'Clients cannot insert cash transactions directly'
);

-------------------------------------------------------------------------------
-- get_financial_summary
-------------------------------------------------------------------------------

select results_eq(
  $$ select (s ->> 'revenue')::numeric, (s ->> 'cogs')::numeric, (s ->> 'gross_profit')::numeric,
            (s ->> 'operating_expenses')::numeric, (s ->> 'other_income')::numeric,
            (s ->> 'net_profit')::numeric
     from public.get_financial_summary((select id from public.businesses)) s $$,
  $$ values (4500::numeric, 2700::numeric, 1800::numeric, 1000::numeric, 300::numeric, 1100::numeric) $$,
  'Profit: revenue − COGS − expenses + other income'
);

select results_eq(
  $$ select (s ->> 'cash_received')::numeric, (s ->> 'cash_paid')::numeric,
            (s ->> 'net_cash_flow')::numeric, (s ->> 'outstanding_balances')::numeric,
            (s ->> 'inventory_value')::numeric
     from public.get_financial_summary((select id from public.businesses)) s $$,
  $$ values (4300::numeric, 1000::numeric, 3300::numeric, 500::numeric, 6300::numeric) $$,
  'Cash flow, customer balances and inventory value'
);

-------------------------------------------------------------------------------
-- void_cash_transaction
-------------------------------------------------------------------------------

select lives_ok(
  $$ select public.void_cash_transaction(id) from public.cash_transactions where kind = 'expense' $$,
  'An expense can be voided'
);

select is(
  (select (public.get_financial_summary((select id from public.businesses)) ->> 'operating_expenses')::numeric),
  0::numeric,
  'A voided expense no longer counts'
);

select throws_ok(
  $$ select public.void_cash_transaction(id) from public.cash_transactions where kind = 'expense' $$,
  '22023',
  'TRANSACTION_ALREADY_VOIDED',
  'An entry cannot be voided twice'
);

-------------------------------------------------------------------------------
-- get_dashboard and access by another user
-------------------------------------------------------------------------------

select results_eq(
  $$ select (d -> 'today' ->> 'revenue')::numeric, (d ->> 'active_products')::int,
            jsonb_array_length(d -> 'recent_sales')
     from public.get_dashboard((select id from public.businesses)) d $$,
  $$ values (4500::numeric, 1, 1) $$,
  'The dashboard shows today''s sales, products and recent sales'
);

-- As the table owner so A's business id is visible, but signed in as B.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-0000000000f2", "role": "authenticated"}';
reset role;

select throws_ok(
  $$ select public.get_financial_summary(id) from public.businesses $$,
  '42501',
  'FORBIDDEN',
  'User B cannot read User A''s figures'
);

select * from finish();
rollback;
