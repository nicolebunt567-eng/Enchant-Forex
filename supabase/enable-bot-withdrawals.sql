-- Run this entire migration once in the Enchant Forex Supabase SQL Editor.

create table if not exists public.bot_withdrawals (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric not null check (amount_usd >= 10),
  asset text not null check (asset in ('USDT', 'BTC', 'ETH')),
  network text not null check (network in ('TRC20', 'BTC', 'ERC20')),
  wallet_address text not null check (char_length(btrim(wallet_address)) >= 10),
  status text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected', 'cancelled')),
  transaction_id text,
  admin_note text,
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (asset = 'USDT' and network = 'TRC20')
    or (asset = 'BTC' and network = 'BTC')
    or (asset = 'ETH' and network = 'ERC20')
  )
);

create index if not exists bot_withdrawals_user_created_idx
on public.bot_withdrawals (user_id, created_at desc);

create or replace function public.request_bot_withdrawal(
  p_amount_usd numeric,
  p_asset text,
  p_network text,
  p_wallet_address text
)
returns public.bot_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed_funding numeric;
  demo_profit numeric;
  locked_withdrawals numeric;
  reserved_funding numeric;
  available_funding numeric;
  created_withdrawal public.bot_withdrawals;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  if p_amount_usd is null or p_amount_usd < 10 then
    raise exception 'Minimum bot withdrawal is $10';
  end if;

  if char_length(btrim(coalesce(p_wallet_address, ''))) < 10 then
    raise exception 'Enter a valid destination wallet address';
  end if;

  if not (
    (p_asset = 'USDT' and p_network = 'TRC20')
    or (p_asset = 'BTC' and p_network = 'BTC')
    or (p_asset = 'ETH' and p_network = 'ERC20')
  ) then
    raise exception 'Unsupported asset and network combination';
  end if;

  perform 1
  from public.profiles
  where id = auth.uid() and suspended = false
  for update;

  if not found then
    raise exception 'This account cannot request withdrawals'
      using errcode = '42501';
  end if;

  select coalesce(sum(amount_usd), 0)
  into confirmed_funding
  from public.bot_deposits
  where user_id = auth.uid() and status = 'confirmed';

  select coalesce(sum(realized_profit), 0)
  into demo_profit
  from public.bot_sessions
  where user_id = auth.uid();

  select coalesce(sum(amount_usd), 0)
  into locked_withdrawals
  from public.bot_withdrawals
  where user_id = auth.uid() and status in ('requested', 'approved', 'paid');

  select coalesce(sum(trade_amount), 0)
  into reserved_funding
  from public.bot_sessions
  where user_id = auth.uid() and status in ('pending', 'ready', 'active', 'paused');

  -- Test workflow only: scripted demo P&L is included in withdrawal capacity.
  available_funding := confirmed_funding + demo_profit - locked_withdrawals - reserved_funding;
  if p_amount_usd > available_funding then
    raise exception 'Withdrawal exceeds the available testing balance';
  end if;

  insert into public.bot_withdrawals (
    user_id, amount_usd, asset, network, wallet_address
  )
  values (
    auth.uid(), round(p_amount_usd, 2), p_asset, p_network, btrim(p_wallet_address)
  )
  returning * into created_withdrawal;

  return created_withdrawal;
end;
$$;

revoke all on function public.request_bot_withdrawal(numeric, text, text, text) from public;
grant execute on function public.request_bot_withdrawal(numeric, text, text, text) to authenticated;

alter table public.bot_withdrawals enable row level security;

drop policy if exists "bot_withdrawals_select_own_or_admin" on public.bot_withdrawals;
create policy "bot_withdrawals_select_own_or_admin" on public.bot_withdrawals
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bot_withdrawals_admin_update" on public.bot_withdrawals;
create policy "bot_withdrawals_admin_update" on public.bot_withdrawals
for update using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.bot_withdrawals;
exception
  when duplicate_object then null;
end
$$;

select 'Bot withdrawals enabled' as result;
