-- ============================================================
-- Makerble Onboarding — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ── profiles ─────────────────────────────────────────────────
-- Extends Supabase auth.users with display name, role, avatar
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  role         text not null default 'member'
              check (role in ('superuser','manager','member')),
  created_at   timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── organisations ─────────────────────────────────────────────
create table if not exists organisations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  logo_url   text,
  created_at timestamptz default now()
);

-- ── org_members ───────────────────────────────────────────────
-- Links users to orgs with a role
create table if not exists org_members (
  id      uuid primary key default uuid_generate_v4(),
  org_id  uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role    text not null default 'member'
         check (role in ('manager','member')),
  unique (org_id, user_id)
);

-- ── programmes ────────────────────────────────────────────────
-- Each org has many programmes
-- journey is a JSONB object keyed by stage id:
--   { signup: ["item1","item2"], assess: [...], ... }
create table if not exists programmes (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  logo_url   text,
  journey    jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── data_collection ───────────────────────────────────────────
-- One row per (programme, stage, journey_item)
-- files is a JSONB array: [{ name, url, path }, ...]
create table if not exists data_collection (
  id             uuid primary key default uuid_generate_v4(),
  programme_id   uuid not null references programmes(id) on delete cascade,
  stage_id       text not null,
  item           text not null,
  responsible    text,
  files          jsonb not null default '[]',
  updated_at     timestamptz default now(),
  unique (programme_id, stage_id, item)
);

-- ── Row Level Security ────────────────────────────────────────

alter table profiles        enable row level security;
alter table organisations   enable row level security;
alter table org_members     enable row level security;
alter table programmes      enable row level security;
alter table data_collection enable row level security;

-- Helpers
create or replace function is_superuser()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'superuser'
  );
$$;

create or replace function is_org_member(org uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from org_members where org_id = org and user_id = auth.uid()
  );
$$;

-- profiles: users can read/update their own; superusers see all
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_superuser());

create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_superuser());

create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid() or is_superuser());

-- organisations: superusers see all; members see their orgs
create policy "orgs_select" on organisations for select
  using (is_superuser() or is_org_member(id));

create policy "orgs_insert" on organisations for insert
  with check (is_superuser());

create policy "orgs_update" on organisations for update
  using (is_superuser() or exists (
    select 1 from org_members where org_id = id and user_id = auth.uid() and role = 'manager'
  ));

-- org_members
create policy "members_select" on org_members for select
  using (is_superuser() or is_org_member(org_id));

create policy "members_insert" on org_members for insert
  with check (is_superuser() or exists (
    select 1 from org_members where org_id = org_id and user_id = auth.uid() and role = 'manager'
  ));

create policy "members_delete" on org_members for delete
  using (is_superuser() or exists (
    select 1 from org_members where org_id = org_id and user_id = auth.uid() and role = 'manager'
  ));

-- programmes
create policy "progs_select" on programmes for select
  using (is_superuser() or is_org_member(org_id));

create policy "progs_insert" on programmes for insert
  with check (is_superuser() or exists (
    select 1 from org_members where org_id = org_id and user_id = auth.uid() and role = 'manager'
  ));

create policy "progs_update" on programmes for update
  using (is_superuser() or is_org_member(org_id));

-- data_collection
create policy "dc_select" on data_collection for select
  using (is_superuser() or exists (
    select 1 from programmes p where p.id = programme_id and is_org_member(p.org_id)
  ));

create policy "dc_insert" on data_collection for insert
  with check (is_superuser() or exists (
    select 1 from programmes p where p.id = programme_id and is_org_member(p.org_id)
  ));

create policy "dc_update" on data_collection for update
  using (is_superuser() or exists (
    select 1 from programmes p where p.id = programme_id and is_org_member(p.org_id)
  ));

create policy "dc_delete" on data_collection for delete
  using (is_superuser() or exists (
    select 1 from programmes p where p.id = programme_id and is_org_member(p.org_id)
  ));

-- ── Storage bucket ────────────────────────────────────────────
-- Create a public bucket called "assets" in Supabase Storage UI,
-- OR run this if the storage schema is available:
--
-- insert into storage.buckets (id, name, public)
-- values ('assets', 'assets', true)
-- on conflict do nothing;
--
-- Storage policies (run in SQL editor):
create policy "assets_public_read" on storage.objects for select
  using (bucket_id = 'assets');

create policy "assets_auth_upload" on storage.objects for insert
  with check (bucket_id = 'assets' and auth.role() = 'authenticated');

create policy "assets_auth_update" on storage.objects for update
  using (bucket_id = 'assets' and auth.role() = 'authenticated');

create policy "assets_auth_delete" on storage.objects for delete
  using (bucket_id = 'assets' and auth.role() = 'authenticated');

-- ── Seed: make Matt a superuser ───────────────────────────────
-- After you sign up with matt@makerble.com, run:
-- update profiles set role = 'superuser' where email = 'matt@makerble.com';
