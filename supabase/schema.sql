create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  nationality text,
  email text not null unique,
  phone text,
  wallet text,
  role text not null default 'user' check (role in ('user', 'admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  name text not null,
  deposit numeric not null,
  return_amount numeric not null,
  duration_hours integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id),
  plan_name text not null,
  deposit numeric not null,
  return_amount numeric not null,
  projected_target numeric,
  duration_hours integer not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'matured', 'withdrawn', 'rejected')),
  withdrawal_step integer not null default 0,
  started_at timestamptz,
  ends_at timestamptz,
  manual_balance numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id integer primary key default 1 check (id = 1),
  usdt text not null default 'TQ9xenchantforexReserveTRC20Address',
  eth text not null default '0xenchantforexReserveEthAddress',
  btc text not null default 'bc1qenchantforexreservebtcaddress',
  updated_at timestamptz not null default now()
);

create table if not exists public.balance_edits (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  investment_id uuid references public.investments(id) on delete cascade,
  admin_id uuid references public.profiles(id),
  value numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  investment_id uuid not null references public.investments(id) on delete cascade,
  symbol text not null default 'XAU/USD',
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  entry_price numeric not null check (entry_price > 0),
  exit_price numeric check (exit_price > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  realized_profit numeric not null default 0,
  price_source text not null default 'operator_record',
  external_trade_id text,
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and exit_price is null and closed_at is null)
    or (status = 'closed' and exit_price is not null and closed_at is not null)
    or status = 'cancelled'
  )
);

create index if not exists trades_investment_opened_idx
on public.trades (investment_id, opened_at desc);

create table if not exists public.bot_sessions (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id uuid not null references public.profiles(id) on delete cascade,
  package_id text not null,
  package_name text not null,
  trading_pair text not null default 'XAU/USD',
  trade_amount numeric not null check (trade_amount > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  passkey text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'active', 'paused', 'completed', 'cancelled')),
  realized_profit numeric not null default 0,
  mode text not null default 'paper' check (mode = 'paper'),
  bias text check (bias in ('bullish', 'bearish')),
  analysis jsonb not null default '[]'::jsonb,
  entry_price numeric check (entry_price > 0),
  exit_price numeric check (exit_price > 0),
  started_at timestamptz,
  ends_at timestamptz,
  completed_at timestamptz,
  rounds_completed integer not null default 0 check (rounds_completed between 0 and 100),
  wins integer not null default 0 check (wins between 0 and 100),
  losses integer not null default 0 check (losses between 0 and 100),
  max_rounds integer not null default 100 check (max_rounds = 100),
  last_round_result text check (last_round_result in ('profit', 'loss')),
  last_round_profit numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_sessions_user_created_idx
on public.bot_sessions (user_id, created_at desc);

create table if not exists public.bot_passkeys (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id uuid references public.profiles(id) on delete cascade,
  package_id text check (package_id is null or package_id in ('basic', 'starter', 'pro', 'vip')),
  package_name text not null,
  code_hash text not null unique,
  status text not null default 'unused' check (status in ('unused', 'used', 'revoked')),
  reusable boolean not null default false,
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  used_at timestamptz,
  session_id uuid references public.bot_sessions(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_passkeys_user_status_idx
on public.bot_passkeys (user_id, status, created_at desc);

alter table public.bot_passkeys
  alter column user_id drop not null,
  alter column package_id drop not null,
  add column if not exists reusable boolean not null default false,
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz;

alter table public.bot_passkeys drop constraint if exists bot_passkeys_package_id_check;
alter table public.bot_passkeys
  add constraint bot_passkeys_package_id_check
  check (package_id is null or package_id in ('basic', 'starter', 'pro', 'vip'));

alter table public.bot_sessions
  add column if not exists passkey_id uuid references public.bot_passkeys(id) on delete set null;

alter table public.bot_sessions
  add column if not exists mode text not null default 'paper',
  add column if not exists bias text,
  add column if not exists analysis jsonb not null default '[]'::jsonb,
  add column if not exists entry_price numeric,
  add column if not exists exit_price numeric,
  add column if not exists started_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists rounds_completed integer not null default 0,
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists max_rounds integer not null default 100,
  add column if not exists last_round_result text,
  add column if not exists last_round_profit numeric not null default 0;

alter table public.bot_sessions drop constraint if exists bot_sessions_status_check;
alter table public.bot_sessions
  add constraint bot_sessions_status_check
  check (status in ('pending', 'ready', 'active', 'paused', 'completed', 'cancelled'));

alter table public.bot_sessions drop constraint if exists bot_sessions_mode_check;
alter table public.bot_sessions
  add constraint bot_sessions_mode_check check (mode = 'paper');

alter table public.bot_sessions drop constraint if exists bot_sessions_bias_check;
alter table public.bot_sessions
  add constraint bot_sessions_bias_check check (bias in ('bullish', 'bearish'));

alter table public.bot_sessions drop constraint if exists bot_sessions_last_round_result_check;
alter table public.bot_sessions
  add constraint bot_sessions_last_round_result_check
  check (last_round_result in ('profit', 'loss'));

create table if not exists public.bot_deposits (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset text not null check (asset in ('USDT', 'BTC', 'ETH')),
  network text not null check (network in ('TRC20', 'BTC', 'ERC20')),
  amount_usd numeric not null check (amount_usd >= 150),
  payment_address text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '40 minutes'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (asset = 'USDT' and network = 'TRC20')
    or (asset = 'BTC' and network = 'BTC')
    or (asset = 'ETH' and network = 'ERC20')
  )
);

create index if not exists bot_deposits_user_created_idx
on public.bot_deposits (user_id, created_at desc);

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

insert into public.plans (name, duration_hours, deposit, return_amount)
select * from (values
  ('1-Day Investment Plan', 24, 500, 4750),
  ('1-Day Investment Plan', 24, 1000, 9500),
  ('2-Day Investment Plan', 48, 2000, 19000),
  ('2-Day Investment Plan', 48, 5000, 47500),
  ('2-Day Investment Plan', 48, 10000, 95000)
) as seed(name, duration_hours, deposit, return_amount)
where not exists (select 1 from public.plans);

insert into public.addresses (id) values (1)
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and suspended = false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, nationality, email, phone, wallet, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'nationality',
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'wallet',
    'user'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    nationality = excluded.nationality,
    email = excluded.email,
    phone = excluded.phone,
    wallet = excluded.wallet,
    updated_at = now();
  return new;
end;
$$;

-- Backfill Auth users created before the profile trigger was installed.
insert into public.profiles (id, full_name, nationality, email, phone, wallet, role)
select
  auth_user.id,
  coalesce(auth_user.raw_user_meta_data->>'full_name', split_part(auth_user.email, '@', 1)),
  auth_user.raw_user_meta_data->>'nationality',
  auth_user.email,
  auth_user.raw_user_meta_data->>'phone',
  auth_user.raw_user_meta_data->>'wallet',
  'user'
from auth.users as auth_user
where auth_user.email is not null
on conflict do nothing;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor, Table Editor, migrations, and service-role operations have no
  -- end-user auth.uid(). RLS still protects public API requests, while this
  -- condition lets a trusted database administrator bootstrap the first admin.
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.suspended is distinct from old.suspended
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only administrators can change protected profile fields'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_investment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan public.plans%rowtype;
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Investments can only be created for the signed-in user'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = auth.uid() and suspended = false
    ) then
      raise exception 'This account cannot create investments'
        using errcode = '42501';
    end if;

    select *
    into selected_plan
    from public.plans
    where id = new.plan_id and active = true;

    if not found then
      raise exception 'The selected investment plan is unavailable'
        using errcode = '23503';
    end if;

    new.plan_name := selected_plan.name;
    new.deposit := selected_plan.deposit;
    new.return_amount := selected_plan.return_amount;
    new.duration_hours := selected_plan.duration_hours;
    new.projected_target := null;
    new.status := 'pending';
    new.withdrawal_step := 0;
    new.started_at := null;
    new.ends_at := null;
    new.manual_balance := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.plan_id is distinct from old.plan_id
    or new.plan_name is distinct from old.plan_name
    or new.deposit is distinct from old.deposit
    or new.return_amount is distinct from old.return_amount
    or new.projected_target is distinct from old.projected_target
    or new.duration_hours is distinct from old.duration_hours
    or new.status is distinct from old.status
    or new.started_at is distinct from old.started_at
    or new.ends_at is distinct from old.ends_at
    or new.manual_balance is distinct from old.manual_balance
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only administrators can change protected investment fields'
      using errcode = '42501';
  end if;

  if not (
    (old.status = 'matured' and old.withdrawal_step <= 1 and new.withdrawal_step = 2)
    or (old.withdrawal_step = 3 and new.withdrawal_step = 4)
  ) then
    raise exception 'Invalid withdrawal stage transition'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.calculate_trade_profit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' then
    if new.exit_price is null then
      raise exception 'A closed trade requires an exit price';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
    new.realized_profit := round(
      case
        when new.side = 'buy' then (new.exit_price - new.entry_price) * new.quantity
        else (new.entry_price - new.exit_price) * new.quantity
      end,
      2
    );
  else
    new.exit_price := null;
    new.closed_at := null;
    new.realized_profit := 0;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_bot_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_address text;
begin
  if new.asset = 'USDT' and new.network = 'TRC20' then
    select usdt into configured_address from public.addresses where id = 1;
  elsif new.asset = 'BTC' and new.network = 'BTC' then
    select btc into configured_address from public.addresses where id = 1;
  elsif new.asset = 'ETH' and new.network = 'ERC20' then
    select eth into configured_address from public.addresses where id = 1;
  else
    raise exception 'Unsupported asset and network combination';
  end if;

  if configured_address is null
    or btrim(configured_address) = ''
    or lower(configured_address) like '%enchantforex%'
  then
    raise exception 'The selected payment address is not configured';
  end if;

  new.payment_address := configured_address;
  new.status := 'pending';
  new.expires_at := now() + interval '40 minutes';
  new.confirmed_at := null;
  new.updated_at := now();
  return new;
end;
$$;

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

  -- Serialize requests for one user so concurrent requests cannot overdraw.
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

drop function if exists public.issue_bot_passkey(uuid, text, integer);

create or replace function public.issue_bot_test_passkey(
  p_expires_days integer default 30
)
returns table (
  passkey_id uuid,
  passkey text,
  package_id text,
  package_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_code text;
  created_key public.bot_passkeys%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can issue bot passkeys'
      using errcode = '42501';
  end if;

  if p_expires_days < 1 or p_expires_days > 365 then
    raise exception 'Passkey expiry must be between 1 and 365 days';
  end if;

  update public.bot_passkeys
  set status = 'revoked', updated_at = now()
  where reusable = true and status = 'unused';

  raw_code := upper(
    'DOM-' ||
    substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
    substr(encode(gen_random_bytes(6), 'hex'), 1, 4)
  );

  insert into public.bot_passkeys (
    user_id,
    package_id,
    package_name,
    code_hash,
    reusable,
    expires_at,
    created_by
  )
  values (
    null,
    null,
    'All Bot Packages',
    encode(digest(raw_code, 'sha256'), 'hex'),
    true,
    now() + make_interval(days => p_expires_days),
    auth.uid()
  )
  returning * into created_key;

  return query
  select
    created_key.id,
    raw_code,
    created_key.package_id,
    created_key.package_name,
    created_key.expires_at;
end;
$$;

create or replace function public.revoke_bot_passkey(p_passkey_id uuid)
returns public.bot_passkeys
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked_key public.bot_passkeys;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can revoke bot passkeys'
      using errcode = '42501';
  end if;

  update public.bot_passkeys
  set status = 'revoked', updated_at = now()
  where id = p_passkey_id and status = 'unused'
  returning * into revoked_key;

  if not found then
    raise exception 'Only an unused passkey can be revoked';
  end if;

  return revoked_key;
end;
$$;

create or replace function public.protect_bot_session()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  funded_balance numeric;
  reserved_balance numeric;
  package_minimum numeric;
  matched_passkey public.bot_passkeys%rowtype;
begin
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op <> 'INSERT' then
    raise exception 'Bot sessions can only be changed through the session controls'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'Bot sessions can only be created for the signed-in user'
      using errcode = '42501';
  end if;

  package_minimum := case new.package_id
    when 'basic' then 150
    when 'starter' then 300
    when 'pro' then 800
    when 'vip' then 1500
    else null
  end;

  if package_minimum is null or new.trade_amount < package_minimum then
    raise exception 'The trading amount is below the selected package minimum';
  end if;

  select coalesce(sum(amount_usd), 0)
  into funded_balance
  from public.bot_deposits
  where user_id = auth.uid() and status = 'confirmed';

  select funded_balance + coalesce(sum(realized_profit), 0)
  into funded_balance
  from public.bot_sessions
  where user_id = auth.uid();

  select coalesce(sum(trade_amount), 0)
  into reserved_balance
  from public.bot_sessions
  where user_id = auth.uid() and status in ('pending', 'ready', 'active', 'paused');

  if new.trade_amount > funded_balance - reserved_balance then
    raise exception 'Trading amount exceeds the available bot balance';
  end if;

  if btrim(coalesce(new.passkey, '')) = '' then
    raise exception 'A passkey is required';
  end if;

  select *
  into matched_passkey
  from public.bot_passkeys
  where (user_id is null or user_id = auth.uid())
    and (package_id is null or package_id = new.package_id)
    and code_hash = encode(digest(upper(btrim(new.passkey)), 'sha256'), 'hex')
    and status = 'unused'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This passkey is invalid, expired, or revoked';
  end if;

  new.passkey_id := matched_passkey.id;
  new.passkey := 'verified';
  new.status := 'ready';
  new.mode := 'paper';
  new.bias := null;
  new.analysis := '[]'::jsonb;
  new.entry_price := null;
  new.exit_price := null;
  new.realized_profit := 0;
  new.started_at := null;
  new.ends_at := null;
  new.completed_at := null;
  new.rounds_completed := 0;
  new.wins := 0;
  new.losses := 0;
  new.max_rounds := 100;
  new.last_round_result := null;
  new.last_round_profit := 0;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.consume_bot_passkey()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passkey_id is not null then
    update public.bot_passkeys
    set status = case when reusable then 'unused' else 'used' end,
        used_at = case when reusable then used_at else now() end,
        session_id = case when reusable then session_id else new.id end,
        use_count = use_count + 1,
        last_used_at = now(),
        updated_at = now()
    where id = new.passkey_id and status = 'unused';

    if not found then
      raise exception 'The selected passkey is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop function if exists public.start_paper_bot_session(uuid, numeric, text, jsonb);

create or replace function public.start_paper_bot_session(p_session_id uuid)
returns public.bot_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.bot_sessions;
begin
  update public.bot_sessions
  set status = 'active',
      mode = 'paper',
      bias = 'bullish',
      analysis = jsonb_build_array(
        'Scanning price structure and liquidity',
        'Evaluating momentum alignment',
        'Calibrating directional confidence',
        format('Monitoring the %s-minute execution window', duration_minutes)
      ),
      started_at = now(),
      ends_at = now() + make_interval(mins => duration_minutes),
      completed_at = null,
      realized_profit = 0,
      rounds_completed = 0,
      wins = 0,
      losses = 0,
      max_rounds = 100,
      last_round_result = null,
      last_round_profit = 0,
      updated_at = now()
  where id = p_session_id
    and user_id = auth.uid()
    and status = 'ready'
  returning * into session_record;

  if not found then
    raise exception 'Ready paper session not found';
  end if;
  return session_record;
end;
$$;

drop function if exists public.complete_paper_bot_session(uuid, numeric);

create or replace function public.advance_demo_bot_session(p_session_id uuid)
returns public.bot_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.bot_sessions;
  next_round integer;
  round_is_profit boolean;
  round_result numeric;
begin
  select * into session_record
  from public.bot_sessions
  where id = p_session_id
    and user_id = auth.uid()
    and status = 'active'
    and ends_at <= now()
  for update;

  if not found then
    select * into session_record
    from public.bot_sessions
    where id = p_session_id
      and user_id = auth.uid();

    if found then
      return session_record;
    end if;

    raise exception 'Demo bot not found';
  end if;

  next_round := session_record.rounds_completed + 1;
  round_is_profit := mod(next_round * 37, 100) < 79;
  round_result := round((
    case
      when round_is_profit then
        session_record.trade_amount
        * (0.08 + random() * 0.04)
        * session_record.duration_minutes
      else
        session_record.trade_amount
        * -(0.02 + random() * 0.04)
    end
  )::numeric,
    2
  );

  update public.bot_sessions
  set rounds_completed = next_round,
      wins = wins + case when round_is_profit then 1 else 0 end,
      losses = losses + case when round_is_profit then 0 else 1 end,
      last_round_result = case when round_is_profit then 'profit' else 'loss' end,
      last_round_profit = round_result,
      realized_profit = realized_profit + round_result,
      bias = case when mod(next_round, 2) = 0 then 'bullish' else 'bearish' end,
      analysis = jsonb_build_array(
        'Market signal cycle complete',
        case when round_is_profit then 'Take-profit threshold reached' else 'Stop-loss threshold reached' end,
        case when round_is_profit then format('Momentum target captured across the %s-minute window', duration_minutes) else 'Risk threshold contained the position' end,
        format('Round %s of 100 recorded', next_round)
      ),
      status = case when next_round >= 100 then 'completed' else 'active' end,
      ends_at = case when next_round >= 100 then ends_at else now() + make_interval(mins => duration_minutes) end,
      completed_at = case when next_round >= 100 then now() else null end,
      updated_at = now()
  where id = p_session_id
  returning * into session_record;

  return session_record;
end;
$$;

create or replace function public.control_demo_bot_session(
  p_session_id uuid,
  p_action text
)
returns public.bot_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.bot_sessions;
begin
  if p_action = 'pause' then
    update public.bot_sessions
    set status = 'paused', ends_at = null, updated_at = now()
    where id = p_session_id and user_id = auth.uid() and status = 'active'
    returning * into session_record;
  elsif p_action = 'resume' then
    update public.bot_sessions
    set status = 'active',
        ends_at = now() + make_interval(mins => duration_minutes),
        updated_at = now()
    where id = p_session_id and user_id = auth.uid() and status = 'paused'
    returning * into session_record;
  elsif p_action = 'stop' then
    update public.bot_sessions
    set status = 'completed', ends_at = null, completed_at = now(), updated_at = now()
    where id = p_session_id and user_id = auth.uid() and status in ('active', 'paused')
    returning * into session_record;
  else
    raise exception 'Invalid demo bot control';
  end if;

  if not found then
    raise exception 'Demo bot cannot perform that action';
  end if;
  return session_record;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

drop trigger if exists protect_investment_fields on public.investments;
create trigger protect_investment_fields
before insert or update on public.investments
for each row execute function public.protect_investment_fields();

drop trigger if exists calculate_trade_profit on public.trades;
create trigger calculate_trade_profit
before insert or update on public.trades
for each row execute function public.calculate_trade_profit();

drop trigger if exists prepare_bot_deposit on public.bot_deposits;
create trigger prepare_bot_deposit
before insert on public.bot_deposits
for each row execute function public.prepare_bot_deposit();

drop trigger if exists protect_bot_session on public.bot_sessions;
create trigger protect_bot_session
before insert on public.bot_sessions
for each row execute function public.protect_bot_session();

drop trigger if exists consume_bot_passkey on public.bot_sessions;
create trigger consume_bot_passkey
after insert on public.bot_sessions
for each row execute function public.consume_bot_passkey();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.investments enable row level security;
alter table public.addresses enable row level security;
alter table public.balance_edits enable row level security;
alter table public.trades enable row level security;
alter table public.bot_sessions enable row level security;
alter table public.bot_passkeys enable row level security;
alter table public.bot_deposits enable row level security;
alter table public.bot_withdrawals enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "plans_select_active" on public.plans;
create policy "plans_select_active" on public.plans
for select using (active = true or public.is_admin());

drop policy if exists "plans_admin_all" on public.plans;
create policy "plans_admin_all" on public.plans
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "investments_select_own_or_admin" on public.investments;
create policy "investments_select_own_or_admin" on public.investments
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "investments_insert_own" on public.investments;
create policy "investments_insert_own" on public.investments
for insert with check (user_id = auth.uid());

drop policy if exists "investments_update_own_claims_or_admin" on public.investments;
create policy "investments_update_own_claims_or_admin" on public.investments
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "addresses_select_all" on public.addresses;
create policy "addresses_select_all" on public.addresses
for select using (true);

drop policy if exists "addresses_admin_update" on public.addresses;
create policy "addresses_admin_update" on public.addresses
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "balance_edits_admin_select" on public.balance_edits;
create policy "balance_edits_admin_select" on public.balance_edits
for select using (public.is_admin());

drop policy if exists "balance_edits_admin_insert" on public.balance_edits;
create policy "balance_edits_admin_insert" on public.balance_edits
for insert with check (public.is_admin());

drop policy if exists "trades_select_own_or_admin" on public.trades;
create policy "trades_select_own_or_admin" on public.trades
for select using (
  public.is_admin()
  or exists (
    select 1 from public.investments
    where investments.id = trades.investment_id
      and investments.user_id = auth.uid()
  )
);

drop policy if exists "trades_admin_insert" on public.trades;
create policy "trades_admin_insert" on public.trades
for insert with check (public.is_admin());

drop policy if exists "trades_admin_update" on public.trades;
create policy "trades_admin_update" on public.trades
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "trades_admin_delete" on public.trades;
create policy "trades_admin_delete" on public.trades
for delete using (public.is_admin());

drop policy if exists "bot_sessions_select_own_or_admin" on public.bot_sessions;
create policy "bot_sessions_select_own_or_admin" on public.bot_sessions
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bot_sessions_insert_own" on public.bot_sessions;
create policy "bot_sessions_insert_own" on public.bot_sessions
for insert with check (user_id = auth.uid());

drop policy if exists "bot_sessions_admin_update" on public.bot_sessions;
create policy "bot_sessions_admin_update" on public.bot_sessions
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bot_sessions_admin_delete" on public.bot_sessions;
create policy "bot_sessions_admin_delete" on public.bot_sessions
for delete using (public.is_admin());

drop policy if exists "bot_passkeys_admin_all" on public.bot_passkeys;
create policy "bot_passkeys_admin_all" on public.bot_passkeys
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bot_deposits_select_own_or_admin" on public.bot_deposits;
create policy "bot_deposits_select_own_or_admin" on public.bot_deposits
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bot_deposits_insert_own" on public.bot_deposits;
create policy "bot_deposits_insert_own" on public.bot_deposits
for insert with check (
  user_id = auth.uid()
  and amount_usd >= 150
  and status = 'pending'
);

drop policy if exists "bot_deposits_admin_update" on public.bot_deposits;
create policy "bot_deposits_admin_update" on public.bot_deposits
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bot_withdrawals_select_own_or_admin" on public.bot_withdrawals;
create policy "bot_withdrawals_select_own_or_admin" on public.bot_withdrawals
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bot_withdrawals_admin_update" on public.bot_withdrawals;
create policy "bot_withdrawals_admin_update" on public.bot_withdrawals
for update using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.trades;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.bot_sessions;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.bot_passkeys;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.bot_deposits;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.bot_withdrawals;
exception
  when duplicate_object then null;
end
$$;

