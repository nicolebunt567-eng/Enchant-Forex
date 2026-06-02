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
  usdt text not null default 'TQ9xEnchantTreasuryTRC20Address',
  eth text not null default '0xEnchantTreasuryEthAddress',
  btc text not null default 'bc1qEnchanttreasurybtcaddress',
  updated_at timestamptz not null default now()
);

create table if not exists public.balance_edits (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  investment_id uuid references public.investments(id) on delete cascade,
  admin_id uuid references public.profiles(id),
  value numeric not null,
  created_at timestamptz not null default now()
);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.investments enable row level security;
alter table public.addresses enable row level security;
alter table public.balance_edits enable row level security;

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

