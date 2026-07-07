-- Run this in Supabase SQL Editor after replacing the email below with the
-- registered Enchant Forex account that should become the first admin.

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

update public.profiles
set role = 'admin'
where lower(email) = lower('REPLACE_WITH_YOUR_REGISTERED_EMAIL');

select id, full_name, email, role, created_at
from public.profiles
order by created_at desc;
