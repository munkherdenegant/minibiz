-- Phase 6: income and expenses, financial summary and home dashboard.
-- See docs/architecture.md, sections 4.2 (cash_categories, cash_transactions), 4.5 and 5.3.

-------------------------------------------------------------------------------
-- cash_categories: expense and other-income categories
-------------------------------------------------------------------------------

create table public.cash_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (char_length(trim(name)) between 1 and 50),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cash_categories_business_kind_name_key
  on public.cash_categories (business_id, kind, lower(name));

create trigger cash_categories_set_updated_at
  before update on public.cash_categories
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- cash_transactions: cash movements not linked to sales (append-only, void instead of delete)
-------------------------------------------------------------------------------

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'inventory_purchase')),
  category_id uuid references public.cash_categories (id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'bank_transfer', 'other')),
  occurred_at timestamptz not null default now(),
  description text check (char_length(description) <= 500),
  inventory_transaction_id uuid references public.inventory_transactions (id) on delete cascade,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Expenses and income need a category; inventory purchases never have one.
  check ((kind = 'inventory_purchase') = (category_id is null))
);

comment on table public.cash_transactions is
  'Expenses, other income and inventory purchases. Sale money lives in sale_payments.';

create index cash_transactions_business_occurred_at_idx
  on public.cash_transactions (business_id, occurred_at desc);

create trigger cash_transactions_set_updated_at
  before update on public.cash_transactions
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Default categories, for new businesses (via create_business) and existing ones
-------------------------------------------------------------------------------

create or replace function public.seed_cash_categories(p_business_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.cash_categories (business_id, kind, name, is_default, sort_order)
  values
    (p_business_id, 'expense', 'Түрээс', true, 1),
    (p_business_id, 'expense', 'Цахилгаан', true, 2),
    (p_business_id, 'expense', 'Тээвэр', true, 3),
    (p_business_id, 'expense', 'Хүргэлт', true, 4),
    (p_business_id, 'expense', 'Маркетинг', true, 5),
    (p_business_id, 'expense', 'Бусад зардал', true, 6),
    (p_business_id, 'income', 'Бусад орлого', true, 1)
  on conflict do nothing;
$$;

select public.seed_cash_categories(id) from public.businesses;

-- Same as before, plus the default categories.
create or replace function public.create_business(
  p_name text,
  p_business_type text,
  p_currency text default 'MNT'
)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'INVALID_BUSINESS_NAME' using errcode = '22023';
  end if;

  insert into public.businesses (name, business_type, currency, created_by)
  values (trim(p_name), p_business_type, upper(coalesce(p_currency, 'MNT')), v_user_id)
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business.id, v_user_id, 'owner');

  perform public.seed_cash_categories(v_business.id);

  return v_business;
end;
$$;

-------------------------------------------------------------------------------
-- create_cash_transaction: record an expense or other income
-------------------------------------------------------------------------------

create or replace function public.create_cash_transaction(
  p_business_id uuid,
  p_kind text,
  p_category_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_occurred_at timestamptz default null,
  p_description text default null
)
returns public.cash_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric := round(p_amount, 2);
  v_description text := nullif(trim(p_description), '');
  v_transaction public.cash_transactions;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if not public.is_business_member(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if coalesce(p_kind, '') not in ('expense', 'income') then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.cash_categories
    where id = p_category_id and business_id = p_business_id and kind = p_kind
  ) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = '22023';
  end if;

  if v_amount is null or v_amount <= 0 or v_amount > 999999999999.99 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  if coalesce(p_method, '') not in ('cash', 'bank_transfer', 'other') then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;

  if char_length(v_description) > 500 then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  insert into public.cash_transactions (
    business_id, kind, category_id, amount, method, occurred_at, description, created_by
  )
  values (
    p_business_id, p_kind, p_category_id, v_amount, p_method,
    coalesce(p_occurred_at, now()), v_description, v_user_id
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-------------------------------------------------------------------------------
-- void_cash_transaction: mark a mistaken entry as void; it stays in history
-------------------------------------------------------------------------------

create or replace function public.void_cash_transaction(p_transaction_id uuid)
returns public.cash_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.cash_transactions;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_transaction
  from public.cash_transactions
  where id = p_transaction_id
  for update;

  if not found or not public.is_business_member(v_transaction.business_id) then
    raise exception 'TRANSACTION_NOT_FOUND' using errcode = '22023';
  end if;

  -- Stock purchases are corrected through stock movements, not here.
  if v_transaction.kind = 'inventory_purchase' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_transaction.voided_at is not null then
    raise exception 'TRANSACTION_ALREADY_VOIDED' using errcode = '22023';
  end if;

  update public.cash_transactions
  set voided_at = now(), voided_by = v_user_id
  where id = p_transaction_id
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-------------------------------------------------------------------------------
-- get_financial_summary: every report figure for [p_from, p_to) (section 5.3)
-- A null bound means unbounded. Balances and inventory value are as of now.
-------------------------------------------------------------------------------

create or replace function public.get_financial_summary(
  p_business_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_from, '-infinity');
  v_to timestamptz := coalesce(p_to, 'infinity');
  v_sales_count integer;
  v_revenue numeric;
  v_cogs numeric;
  v_expenses numeric;
  v_other_income numeric;
  v_purchases numeric;
  v_losses numeric;
  v_payments_in numeric;
  v_refunds numeric;
  v_outstanding numeric;
  v_inventory_value numeric;
  v_gross numeric;
  v_cash_received numeric;
  v_cash_paid numeric;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(total_amount), 0), coalesce(sum(total_cost), 0)
  into v_sales_count, v_revenue, v_cogs
  from public.sales
  where business_id = p_business_id
    and status = 'completed'
    and sold_at >= v_from and sold_at < v_to;

  select
    coalesce(sum(amount) filter (where kind = 'expense'), 0),
    coalesce(sum(amount) filter (where kind = 'income'), 0),
    coalesce(sum(amount) filter (where kind = 'inventory_purchase'), 0)
  into v_expenses, v_other_income, v_purchases
  from public.cash_transactions
  where business_id = p_business_id
    and voided_at is null
    and occurred_at >= v_from and occurred_at < v_to;

  -- A net stock gain from adjustments lowers the losses.
  select coalesce(round(-sum(quantity_change * unit_cost), 2), 0)
  into v_losses
  from public.inventory_transactions
  where business_id = p_business_id
    and type in ('damage', 'adjustment')
    and occurred_at >= v_from and occurred_at < v_to;

  select
    coalesce(sum(amount) filter (where amount > 0), 0),
    coalesce(-sum(amount) filter (where amount < 0), 0)
  into v_payments_in, v_refunds
  from public.sale_payments
  where business_id = p_business_id
    and paid_at >= v_from and paid_at < v_to;

  select coalesce(sum(balance_due), 0)
  into v_outstanding
  from public.sales
  where business_id = p_business_id and status = 'completed';

  select coalesce(round(sum(current_stock * avg_cost), 2), 0)
  into v_inventory_value
  from public.products
  where business_id = p_business_id and current_stock > 0;

  v_gross := v_revenue - v_cogs;
  v_cash_received := v_payments_in + v_other_income;
  v_cash_paid := v_expenses + v_purchases + v_refunds;

  return jsonb_build_object(
    'sales_count', v_sales_count,
    'revenue', v_revenue,
    'cogs', v_cogs,
    'gross_profit', v_gross,
    'operating_expenses', v_expenses,
    'inventory_losses', v_losses,
    'other_income', v_other_income,
    'net_profit', v_gross - v_expenses - v_losses + v_other_income,
    'cash_received', v_cash_received,
    'cash_paid', v_cash_paid,
    'net_cash_flow', v_cash_received - v_cash_paid,
    'outstanding_balances', v_outstanding,
    'inventory_value', v_inventory_value
  );
end;
$$;

-------------------------------------------------------------------------------
-- get_dashboard: today's figures (business time zone), stock alerts, last sales
-------------------------------------------------------------------------------

create or replace function public.get_dashboard(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_today_start timestamptz;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select timezone into v_timezone from public.businesses where id = p_business_id;
  v_today_start := date_trunc('day', now() at time zone v_timezone) at time zone v_timezone;

  return jsonb_build_object(
    'today', public.get_financial_summary(
      p_business_id, v_today_start, v_today_start + interval '1 day'
    ),
    'active_products', (
      select count(*) from public.products
      where business_id = p_business_id and is_active
    ),
    'low_stock_count', (
      select count(*) from public.products
      where business_id = p_business_id and is_active
        and low_stock_threshold is not null and current_stock <= low_stock_threshold
    ),
    'low_stock', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.current_stock - p.low_stock_threshold, p.name)
      from (
        select id, name, unit, current_stock, low_stock_threshold
        from public.products
        where business_id = p_business_id and is_active
          and low_stock_threshold is not null and current_stock <= low_stock_threshold
        order by current_stock - low_stock_threshold, name
        limit 5
      ) p
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.sold_at desc, s.id)
      from (
        select * from public.sales
        where business_id = p_business_id
        order by sold_at desc, id
        limit 5
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-------------------------------------------------------------------------------
-- Privileges
-------------------------------------------------------------------------------

revoke all on table public.cash_categories, public.cash_transactions from anon;
revoke all on table public.cash_categories, public.cash_transactions from authenticated;

-- Members may manage their own categories; transactions are written by functions only.
grant select, delete on table public.cash_categories to authenticated;
grant insert (business_id, kind, name, sort_order) on table public.cash_categories to authenticated;
grant update (name, sort_order) on table public.cash_categories to authenticated;
grant select on table public.cash_transactions to authenticated;

revoke execute on function public.seed_cash_categories(uuid) from public, anon, authenticated;
revoke execute on function public.create_cash_transaction(
  uuid, text, uuid, numeric, text, timestamptz, text
) from public, anon;
revoke execute on function public.void_cash_transaction(uuid) from public, anon;
revoke execute on function public.get_financial_summary(uuid, timestamptz, timestamptz)
  from public, anon;
revoke execute on function public.get_dashboard(uuid) from public, anon;
grant execute on function public.create_cash_transaction(
  uuid, text, uuid, numeric, text, timestamptz, text
) to authenticated;
grant execute on function public.void_cash_transaction(uuid) to authenticated;
grant execute on function public.get_financial_summary(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.get_dashboard(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------

alter table public.cash_categories enable row level security;
alter table public.cash_transactions enable row level security;

create policy "Members can view cash categories"
  on public.cash_categories for select to authenticated
  using (public.is_business_member(business_id));

create policy "Members can add cash categories"
  on public.cash_categories for insert to authenticated
  with check (public.is_business_member(business_id));

create policy "Members can rename cash categories"
  on public.cash_categories for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy "Members can delete cash categories"
  on public.cash_categories for delete to authenticated
  using (public.is_business_member(business_id));

create policy "Members can view cash transactions"
  on public.cash_transactions for select to authenticated
  using (public.is_business_member(business_id));
