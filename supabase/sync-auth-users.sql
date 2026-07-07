-- Run once in the Supabase SQL Editor if Authentication users are missing
-- from Table Editor > public.profiles.

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

select id, full_name, email, role, created_at
from public.profiles
order by created_at desc;
