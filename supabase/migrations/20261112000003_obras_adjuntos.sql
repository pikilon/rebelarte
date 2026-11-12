-- 03 · Obras y adjuntos

create table public.works (
  id                  uuid primary key default gen_random_uuid(),
  short_id            text not null unique,
  uploader_id         uuid not null references public.profiles(id) on delete cascade,
  branch              text not null references public.branches(id),
  category_id         int references public.categories(id),
  title               jsonb not null check (public.is_i18n(title)),
  description         jsonb not null default '{}' check (public.is_i18n(description)),
  keywords            text[] not null default '{}' check (cardinality(keywords) <= 20),
  place               text check (char_length(place) <= 200),
  created_on          date,
  lang                text not null default 'es' check (lang in ('es', 'en')),
  license_id          text not null default 'cc-by-nc-nd-4.0' references public.licenses(id),
  visibility          text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  status              text not null default 'draft' check (status in ('draft', 'review', 'published', 'hidden', 'deleted')),
  for_sale            boolean not null default false,
  accepts_commissions boolean not null default false,
  price_text          text check (char_length(price_text) <= 120),
  cover_attachment_id uuid,   -- FK a attachments más abajo (dependencia circular)
  video_url           text check (video_url ~* '^https?://'),
  audio_embed_url     text check (audio_embed_url ~* '^https?://'),
  -- campos por rama
  technique           text check (char_length(technique) <= 200),
  pages               int check (pages > 0),
  duration_seconds    int check (duration_seconds >= 0),
  audio_channels      text check (char_length(audio_channels) <= 40),
  recording_format    text check (char_length(recording_format) <= 80),
  aspect_ratio        text check (char_length(aspect_ratio) <= 20),
  search              tsvector,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- el título debe existir en el idioma de origen
  constraint works_title_in_lang check (coalesce(title ->> lang, '') <> '')
);
create index works_uploader        on public.works (uploader_id);
create index works_listing         on public.works (branch, category_id, published_at desc)
  where status = 'published' and visibility = 'public';
create index works_recent          on public.works (published_at desc)
  where status = 'published' and visibility = 'public';
create index works_search          on public.works using gin (search);

create trigger works_short_id before insert or update on public.works
  for each row execute function public.tg_set_short_id();
create trigger works_updated_at before update on public.works
  for each row execute function public.set_updated_at();

-- tsvector multilingüe: título (A), palabras clave (B), descripción (C) de todos
-- los idiomas, config 'simple' y sin acentos (f_unaccent) para que «cancion»
-- encuentre «canción» y viceversa.
create or replace function public.tg_works_search()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.search :=
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(
      (select string_agg(value, ' ') from jsonb_each_text(new.title)), ''))), 'A')
 || setweight(to_tsvector('simple', public.f_unaccent(
      coalesce(array_to_string(new.keywords, ' '), ''))), 'B')
 || setweight(to_tsvector('simple', public.f_unaccent(coalesce(
      (select string_agg(value, ' ') from jsonb_each_text(new.description)), ''))), 'C');
  return new;
end $$;
create trigger works_search before insert or update of title, description, keywords on public.works
  for each row execute function public.tg_works_search();

-- Guarda de obras (security definer: lee categorías y adjuntos sin RLS).
--  * uploader_id, created_at y published_at no los controla el cliente.
--  * 'hidden' es solo de moderación: el subidor no puede ponerlo ni salir de él.
--  * 'deleted' es de un solo sentido para el cliente (si no, deshacería un
--    borrado de moderación).
--  * La categoría debe ser de la misma rama; la portada, una imagen de la obra.
create or replace function public.tg_works_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_client() and new.status in ('hidden', 'deleted') then
      raise exception 'moderation_only' using errcode = '42501';
    end if;
    new.published_at := case when new.status = 'published' then now() end;
  else
    new.uploader_id := old.uploader_id;
    new.created_at  := old.created_at;
    if public.is_client() and (
         (new.status = 'hidden') <> (old.status = 'hidden')
      or (old.status = 'deleted' and new.status <> 'deleted')
    ) then
      raise exception 'moderation_only' using errcode = '42501';
    end if;
    new.published_at := coalesce(old.published_at, case when new.status = 'published' then now() end);
  end if;

  if new.category_id is not null and not exists (
       select 1 from public.categories c where c.id = new.category_id and c.branch = new.branch) then
    raise exception 'category_branch_mismatch' using errcode = '23514';
  end if;

  if new.cover_attachment_id is not null and not exists (
       select 1 from public.attachments a
       where a.id = new.cover_attachment_id and a.work_id = new.id and a.kind = 'image') then
    raise exception 'invalid_cover' using errcode = '23514',
      hint = 'La portada debe ser una imagen adjunta de la propia obra';
  end if;
  return new;
end $$;
create trigger works_guard before insert or update on public.works
  for each row execute function public.tg_works_guard();

alter table public.works enable row level security;

-- ---------------------------------------------------------------------------
-- Adjuntos de obra (máx. 6, límites por tipo)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works(id) on delete cascade,
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
  -- límites de types.ts LIMITS: imagen 10 MB, PDF 20 MB, ZIP 10 MB, audio 30 MB
  check (size_bytes <= case kind when 'image' then 10485760 when 'pdf' then 20971520
                                 when 'zip' then 10485760 else 31457280 end),
  check (case kind when 'image' then mime like 'image/%'
                   when 'pdf'   then mime = 'application/pdf'
                   when 'zip'   then mime in ('application/zip', 'application/x-zip-compressed')
                   else mime like 'audio/%' end)
);
create index attachments_work on public.attachments (work_id, sort);

alter table public.works
  add constraint works_cover_fk foreign key (cover_attachment_id)
  references public.attachments(id) on delete set null;

create or replace function public.tg_attachments_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- bloquea la fila de la obra para que dos inserciones concurrentes no se cuelen
  perform 1 from public.works where id = new.work_id for update;
  if (select count(*) from public.attachments
      where work_id = new.work_id and id <> new.id) >= 6 then
    raise exception 'attachment_limit' using errcode = 'P0001',
      hint = 'Máximo 6 adjuntos por obra';
  end if;
  return new;
end $$;
create trigger attachments_limit before insert or update of work_id on public.attachments
  for each row execute function public.tg_attachments_limit();

alter table public.attachments enable row level security;
