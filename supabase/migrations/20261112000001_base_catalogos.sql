-- 01 · Extensiones, utilidades comunes y catálogos
-- Rebelarte 2.0 (docs/arquitectura.md §4). Comentarios en español.
--
-- Convenciones de todo el esquema:
--  * Textos traducibles = jsonb {"es": "...", "en": "..."} (ver is_i18n).
--  * `text` + CHECK en vez de enums de Postgres (migraciones más fáciles).
--  * Las extensiones viven en el schema `extensions` (como en Supabase). Las
--    funciones que usan citext/unaccent/pgcrypto llevan
--    `set search_path = public, extensions` (con solo `public` los operadores de
--    citext no se resuelven y `citext = text` cae a comparar como text).

create extension if not exists citext   with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

-- ¿La sentencia la lanza directamente un cliente (PostgREST cambia a anon /
-- authenticated)? Dentro de una función security definer current_user es el
-- propietario, así que las RPC y los triggers security definer no cuentan como
-- «cliente». Se usa en los triggers de guarda (campos que solo moderación o el
-- sistema pueden tocar).
create or replace function public.is_client()
returns boolean language sql stable as $$
  select current_user in ('anon', 'authenticated')
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- unaccent con diccionario fijo y marcada immutable (patrón habitual para poder
-- usarla en índices y columnas generadas).
create or replace function public.f_unaccent(p text)
returns text language sql immutable parallel safe
set search_path = public, extensions as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p)
$$;

-- Texto traducible válido: objeto con claves es/en y valores string (o null).
create or replace function public.is_i18n(j jsonb)
returns boolean language sql immutable as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and (j - array['es', 'en']) = '{}'::jsonb
     and not exists (
       select 1 from jsonb_each(j) e
       where jsonb_typeof(e.value) not in ('string', 'null')
     )
$$;

-- Identificador corto: 8 caracteres base62. Se descartan bytes >= 248 (62*4)
-- para que la distribución sea uniforme.
create or replace function public.gen_short_id()
returns text language plpgsql volatile
set search_path = public, extensions as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := '';
  b bytea;
  v int;
  i int;
begin
  while length(result) < 8 loop
    b := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v := get_byte(b, i);
      if v < 248 then
        result := result || substr(alphabet, (v % 62) + 1, 1);
        exit when length(result) = 8;
      end if;
    end loop;
  end loop;
  return result;
end $$;

-- Trigger genérico: asigna short_id único (reintento ante colisión) al insertar
-- e impide cambiarlo después. security definer para ver todas las filas aunque
-- RLS oculte alguna (si no, la colisión solo se detectaría por el unique).
create or replace function public.tg_set_short_id()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v text;
  n int := 0;
  taken boolean;
begin
  if tg_op = 'UPDATE' then
    new.short_id := old.short_id;
    return new;
  end if;
  loop
    v := public.gen_short_id();
    execute format('select exists (select 1 from %I.%I where short_id = $1)',
                   tg_table_schema, tg_table_name) into taken using v;
    exit when not taken;
    n := n + 1;
    if n > 20 then raise exception 'short_id_exhausted'; end if;
  end loop;
  new.short_id := v;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------

create table public.branches (
  id   text primary key check (id in ('plasticas', 'textos', 'escenicas', 'sonido', 'audiovisuales')),
  name jsonb not null check (public.is_i18n(name)),
  sort int not null default 0
);

create table public.categories (
  id     serial primary key,
  branch text not null references public.branches(id) on delete cascade,
  slug   text not null check (slug ~ '^[a-z0-9-]+$'),
  name   jsonb not null check (public.is_i18n(name)),
  sort   int not null default 0,
  unique (branch, slug)
);

-- branch null = cargo válido en todas las ramas.
create table public.role_catalog (
  id     serial primary key,
  branch text references public.branches(id) on delete cascade,
  slug   text not null check (slug ~ '^[a-z0-9-]+$'),
  name   jsonb not null check (public.is_i18n(name)),
  sort   int not null default 0
);
create unique index role_catalog_branch_slug_key on public.role_catalog ((coalesce(branch, '*')), slug);

create table public.licenses (
  id   text primary key,
  name jsonb not null check (public.is_i18n(name)),
  url  text
);

alter table public.branches     enable row level security;
alter table public.categories   enable row level security;
alter table public.role_catalog enable row level security;
alter table public.licenses     enable row level security;
