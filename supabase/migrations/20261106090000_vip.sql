-- VIP plans paid through Wire (wire.mn). A business owner buys a plan; the money goes to
-- the Ashi operator's Wire project. The Wire secret key lives only in Edge Function secrets
-- (WIRE_SECRET_KEY); payments are activated by the vip-checkout and wire-webhook functions.

-------------------------------------------------------------------------------
-- vip_plans: what can be bought. Change prices here (whole tögrög).
-------------------------------------------------------------------------------

create table public.vip_plans (
  id text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  name text not null check (char_length(trim(name)) between 1 and 60),
  -- Wire only takes whole tögrög between 1 and 1,000,000,000.
  price integer not null check (price between 1 and 1000000000),
  duration_days integer not null check (duration_days between 1 and 3660),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vip_plans_set_updated_at
  before update on public.vip_plans
  for each row execute function public.set_updated_at();

insert into public.vip_plans (id, name, price, duration_days, sort_order)
values
  ('monthly', 'VIP · 1 сар', 9900, 30, 1),
  ('yearly', 'VIP · 1 жил', 99000, 365, 2);

-------------------------------------------------------------------------------
-- businesses.vip_until: VIP is active while this is in the future
-------------------------------------------------------------------------------

alter table public.businesses add column vip_until timestamptz;

comment on column public.businesses.vip_until is
  'End of the paid VIP period. Only changed by activate_vip (clients have no update grant).';

-------------------------------------------------------------------------------
-- vip_payments: one Wire PaymentIntent per purchase attempt
-------------------------------------------------------------------------------

create table public.vip_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan_id text not null references public.vip_plans (id),
  amount integer not null check (amount > 0),
  duration_days integer not null check (duration_days > 0),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'canceled', 'failed')),
  payment_intent_id text not null unique,
  checkout_url text not null,
  paid_at timestamptz,
  vip_until timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vip_payments is
  'VIP purchases. Written only by Edge Functions with the service role.';

create index vip_payments_business_created_idx
  on public.vip_payments (business_id, created_at desc);

create trigger vip_payments_set_updated_at
  before update on public.vip_payments
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- activate_vip: apply a paid PaymentIntent exactly once (webhook and sync may race)
-------------------------------------------------------------------------------

create or replace function public.activate_vip(p_payment_intent_id text, p_amount integer)
returns public.vip_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.vip_payments;
  v_until timestamptz;
begin
  select * into v_payment
  from public.vip_payments
  where payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'VIP_PAYMENT_NOT_FOUND' using errcode = '22023';
  end if;

  if v_payment.status = 'succeeded' then
    return v_payment; -- Already applied.
  end if;

  if p_amount is distinct from v_payment.amount then
    raise exception 'VIP_AMOUNT_MISMATCH' using errcode = '22023';
  end if;

  -- Extend from the current end if VIP is still running, otherwise from now.
  update public.businesses
  set vip_until = greatest(coalesce(vip_until, now()), now())
                  + make_interval(days => v_payment.duration_days)
  where id = v_payment.business_id
  returning vip_until into v_until;

  update public.vip_payments
  set status = 'succeeded', paid_at = now(), vip_until = v_until
  where id = v_payment.id
  returning * into v_payment;

  return v_payment;
end;
$$;

-------------------------------------------------------------------------------
-- Privileges and RLS
-------------------------------------------------------------------------------

revoke all on table public.vip_plans, public.vip_payments from anon, authenticated;
grant select on table public.vip_plans, public.vip_payments to authenticated;

revoke execute on function public.activate_vip(text, integer) from public, anon, authenticated;
grant execute on function public.activate_vip(text, integer) to service_role;

alter table public.vip_plans enable row level security;
alter table public.vip_payments enable row level security;

create policy "Signed-in users can view active VIP plans"
  on public.vip_plans for select to authenticated
  using (is_active);

create policy "Members can view their VIP payments"
  on public.vip_payments for select to authenticated
  using (public.is_business_member(business_id));
