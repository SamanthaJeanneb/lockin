-- ============================================================================
-- LOCKIN — MIGRATION 002: row level security + provisioning
-- ============================================================================
-- Every user-scoped table carries the same policy: you can only touch rows
-- where user_id = auth.uid(). Verified by the two-user test in the kickoff
-- checklist.
--
-- The server also filters by user_id in application code. RLS is the floor,
-- not the only guard — if a query ever loses its filter, the database still
-- refuses.
-- ============================================================================

-- On Supabase the `auth` schema and `auth.uid()` already exist. On a plain
-- Postgres (local Docker, a self-hosted deploy) they do not, so a compatible
-- stub is created here. Identical policy text then works in both places.
do $outer$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute 'create function auth.uid() returns uuid language sql stable as '
         || '$f$ select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid $f$';
  end if;
end
$outer$;

do $$
declare t text;
begin
  foreach t in array array[
    'app_user','user_settings','life_area','object','edge','activity','metric',
    'model_fact','capture','attachment','integration','account','transaction',
    'recurring_charge','scenario','calendar_event','review','notification',
    'push_subscription','saved_view'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
  end loop;
end $$;

-- app_user keys on id, not user_id.
create policy own_rows on app_user for all
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','life_area','object','edge','activity','metric','model_fact',
    'capture','attachment','integration','account','transaction','recurring_charge',
    'scenario','calendar_event','review','notification','push_subscription','saved_view'
  ] loop
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid())
       with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- The vocabulary is global and read-only.
alter table object_type enable row level security;
drop policy if exists read_all on object_type;
create policy read_all on object_type for select using (true);

-- A public annual review is readable by anyone holding the slug.
drop policy if exists public_share on review;
create policy public_share on review for select
  using (is_public = true and share_slug is not null);


-- ----------------------------------------------------------------------------
-- Provisioning: a new auth user gets an app_user, settings, and the default
-- life areas, in one transaction, before their first request lands.
-- ----------------------------------------------------------------------------

create or replace function provision_user(p_id uuid, p_email text, p_name text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into app_user (id, email, name)
  values (p_id, p_email, coalesce(p_name, split_part(p_email, '@', 1)))
  on conflict (id) do update set email = excluded.email;

  insert into user_settings (user_id) values (p_id) on conflict do nothing;

  insert into life_area (user_id, key, label, series, position, priority)
  values
    (p_id, 'career',        'Career',        1, 0, 1),
    (p_id, 'finance',       'Finance',       2, 1, 2),
    (p_id, 'health',        'Health',        3, 2, 3),
    (p_id, 'relationships', 'Relationships', 4, 3, 4),
    (p_id, 'learning',      'Learning',      5, 4, 5),
    (p_id, 'creative',      'Creative',      6, 5, 6),
    (p_id, 'home',          'Home',          7, 6, 7),
    (p_id, 'adventure',     'Adventure',     8, 7, 8)
  on conflict (user_id, key) do nothing;

  update user_settings
     set area_priority = array['career','finance','health','relationships','learning']
   where user_id = p_id and cardinality(area_priority) = 0;
end;
$$;

create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform provision_user(new.id, new.email, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'auth' and table_name = 'users') then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'create trigger on_auth_user_created after insert on auth.users
             for each row execute function handle_new_auth_user()';
  end if;
end $$;
