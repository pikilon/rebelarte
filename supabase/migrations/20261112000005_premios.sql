-- 05 · Premios y enlaces premio-obra / premio-persona

create table public.awards (
  id           uuid primary key default gen_random_uuid(),
  name         jsonb not null check (public.is_i18n(name)),
  year         int check (year between 1800 and 2200),
  organization text check (char_length(organization) <= 200),
  description  jsonb not null default '{}' check (public.is_i18n(description)),
  image_path   text,
  lang         text not null default 'es' check (lang in ('es', 'en')),
  verified     boolean not null default false,
  verified_by  uuid references public.profiles(id) on delete set null,
  verified_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint awards_name_in_lang check (coalesce(name ->> lang, '') <> '')
);

-- El sello «verificado» solo lo pone moderación (RPC moderate). Si el creador
-- edita los datos de un premio verificado, el sello se pierde.
create or replace function public.tg_awards_guard()
returns trigger language plpgsql as $$
begin
  if public.is_client() then
    if tg_op = 'INSERT' then
      new.verified := false; new.verified_by := null; new.verified_at := null;
    else
      new.verified    := old.verified;
      new.verified_by := old.verified_by;
      new.verified_at := old.verified_at;
      new.created_by  := old.created_by;
      if old.verified and (new.name is distinct from old.name or new.year is distinct from old.year
                           or new.organization is distinct from old.organization) then
        new.verified := false; new.verified_by := null; new.verified_at := null;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger awards_guard before insert or update on public.awards
  for each row execute function public.tg_awards_guard();

create table public.award_links (
  id         uuid primary key default gen_random_uuid(),
  award_id   uuid not null references public.awards(id) on delete cascade,
  work_id    uuid references public.works(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(work_id, profile_id) = 1)
);
create unique index award_links_work_uq    on public.award_links (award_id, work_id)    where work_id is not null;
create unique index award_links_profile_uq on public.award_links (award_id, profile_id) where profile_id is not null;
create index award_links_work    on public.award_links (work_id)    where work_id is not null;
create index award_links_profile on public.award_links (profile_id) where profile_id is not null;

alter table public.awards      enable row level security;
alter table public.award_links enable row level security;
