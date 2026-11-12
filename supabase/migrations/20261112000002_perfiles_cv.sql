-- 02 · Perfiles, CV y adjuntos del CV

create or replace function public.is_field_visibility(j jsonb)
returns boolean language sql immutable as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and (j - array['location', 'contact_email', 'rate', 'cover_letter']) = '{}'::jsonb
     and not exists (
       select 1 from jsonb_each(j) e
       where jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') not in ('public', 'registered', 'private')
     )
$$;

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  -- alias: 3-30 caracteres, minúsculas/dígitos/guion, sin guion al principio ni al final.
  -- citext para que las búsquedas `alias = 'Ana'` no distingan mayúsculas.
  alias               extensions.citext not null unique
                      check (alias::text ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  short_id            text not null unique,
  display_name        text not null check (char_length(btrim(display_name)) between 1 and 80),
  lang                text not null default 'es' check (lang in ('es', 'en')),
  headline            jsonb not null default '{}' check (public.is_i18n(headline)),
  cover_letter        jsonb not null default '{}' check (public.is_i18n(cover_letter)),
  location            text check (char_length(location) <= 120),
  avatar_path         text,
  contact_email       text check (contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  show_email          boolean not null default false,
  accepts_commissions boolean not null default false,
  sells_works         boolean not null default false,
  rate_text           jsonb not null default '{}' check (public.is_i18n(rate_text)),
  rate_price          text check (char_length(rate_price) <= 120),
  field_visibility    jsonb not null default '{}' check (public.is_field_visibility(field_visibility)),
  role                text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  status              text not null default 'active' check (status in ('active', 'suspended')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- alias reservados (rutas de la SPA, arquitectura §3)
  constraint profiles_alias_not_reserved check (
    alias::text <> all (array['buscar','rama','obra','entrar','mi','moderacion','legal','admin',
                              'api','c','o','es','en','static','_app','share'])
  )
);
-- Búsqueda de autores por nombre/alias sin acentos (search_profiles)
create index profiles_search_trgm on public.profiles using gin (
  (public.f_unaccent(lower(display_name || ' ' || alias::text))) extensions.gin_trgm_ops
);

create trigger profiles_short_id before insert or update on public.profiles
  for each row execute function public.tg_set_short_id();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Guarda: un cliente no puede cambiar rol, estado, id ni short_id (además de que
-- los column privileges de 08 ya no le dejan tocarlos). Moderación cambia status
-- desde la RPC moderate (security definer => current_user no es «cliente»), y los
-- administradores asignan role por SQL como propietario.
create or replace function public.tg_profiles_guard()
returns trigger language plpgsql as $$
begin
  if public.is_client() and (
       new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.short_id is distinct from old.short_id
  ) then
    raise exception 'forbidden_columns' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.tg_profiles_guard();

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Funciones de identidad usadas por políticas y RPC.
-- security definer: leen profiles sin pasar por RLS (que solo deja leer el
-- perfil propio).
-- ---------------------------------------------------------------------------
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('moderator', 'admin') and status = 'active')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and status = 'active')
$$;

-- ¿El usuario actual tiene perfil activo (no suspendido)? Los suspendidos no escriben.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

create or replace function public.is_active_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_id and status = 'active')
$$;

-- ---------------------------------------------------------------------------
-- CV
-- ---------------------------------------------------------------------------
create table public.cv_entries (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('education','course','degree','experience','skill','material','other')),
  title        jsonb not null check (public.is_i18n(title)),
  organization text check (char_length(organization) <= 200),
  start_date   date,
  end_date     date,
  description  jsonb not null default '{}' check (public.is_i18n(description)),
  lang         text not null default 'es' check (lang in ('es', 'en')),
  visibility   text not null default 'public' check (visibility in ('public', 'registered', 'private')),
  sort         int not null default 0,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index cv_entries_profile on public.cv_entries (profile_id, sort);
alter table public.cv_entries enable row level security;

-- Adjuntos del CV: mismo formato que `attachments`, máx. 6 por perfil.
create table public.profile_attachments (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('image', 'pdf', 'zip', 'audio')),
  path       text not null,
  thumb_path text,
  mime       text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width      int,
  height     int,
  title      text check (char_length(title) <= 200),
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  -- límites de tamaño por tipo (types.ts LIMITS)
  check (size_bytes <= case kind when 'image' then 10485760 when 'pdf' then 20971520
                                 when 'zip' then 10485760 else 31457280 end),
  check (case kind when 'image' then mime like 'image/%'
                   when 'pdf'   then mime = 'application/pdf'
                   when 'zip'   then mime in ('application/zip', 'application/x-zip-compressed')
                   else mime like 'audio/%' end)
);
create index profile_attachments_profile on public.profile_attachments (profile_id, sort);

create or replace function public.tg_profile_attachments_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profile_attachments
      where profile_id = new.profile_id and id <> new.id) >= 6 then
    raise exception 'attachment_limit' using errcode = 'P0001',
      hint = 'Máximo 6 adjuntos por CV';
  end if;
  return new;
end $$;
create trigger profile_attachments_limit before insert or update of profile_id on public.profile_attachments
  for each row execute function public.tg_profile_attachments_limit();
alter table public.profile_attachments enable row level security;
