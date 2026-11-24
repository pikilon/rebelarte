-- 14 · Correcciones de los advisors de Supabase (seguridad y rendimiento)
--
-- Las vistas profiles_public y works_cards son SECURITY DEFINER a propósito
-- (exponen solo columnas públicas sin dar lectura directa a las tablas); el
-- advisor las marca como ERROR y se acepta. Las funciones is_* se usan en las
-- políticas RLS y deben seguir siendo ejecutables por anon/authenticated.

-- 1. search_path fijo en funciones sin él
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('is_client','set_updated_at','is_i18n','is_field_visibility',
                         'tg_profiles_guard','tg_awards_guard','tg_conversations_guard',
                         'tg_messages_guard','tg_notifications_guard',
                         'tg_moderation_actions_immutable','_field_visible')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- 2. Las funciones de trigger no se llaman por la API: fuera de PostgREST
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'tg\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 3. RLS: auth.uid() como subconsulta (se evalúa una vez por consulta, no por fila)
do $$
declare
  pol record;
  q text;
  w text;
  stmt text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
       and coalesce(qual, '') !~* 'select auth\.uid\(\)'
       and coalesce(with_check, '') !~* 'select auth\.uid\(\)'
  loop
    q := replace(pol.qual, 'auth.uid()', '(select auth.uid())');
    w := replace(pol.with_check, 'auth.uid()', '(select auth.uid())');
    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- 4. Catálogos: la política de admin "for all" se solapaba con la de lectura
drop policy if exists branches_admin   on public.branches;
drop policy if exists categories_admin on public.categories;
drop policy if exists roles_admin      on public.role_catalog;
drop policy if exists licenses_admin   on public.licenses;

do $$
declare t text; n text;
begin
  for t, n in values ('branches','branches'), ('categories','categories'),
                     ('role_catalog','roles'), ('licenses','licenses')
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', n || '_admin_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', n || '_admin_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', n || '_admin_del', t);
  end loop;
end $$;

-- 5. Índices en claves foráneas sin cobertura
create index if not exists award_links_created_by      on public.award_links (created_by);
create index if not exists awards_created_by           on public.awards (created_by);
create index if not exists awards_verified_by          on public.awards (verified_by);
create index if not exists conversations_work          on public.conversations (work_id);
create index if not exists participation_roles_role    on public.participation_roles (role_id);
create index if not exists participations_created_by   on public.participations (created_by);
create index if not exists reports_resolved_by         on public.reports (resolved_by);
create index if not exists role_catalog_branch         on public.role_catalog (branch);
create index if not exists works_category              on public.works (category_id);
create index if not exists works_cover                 on public.works (cover_attachment_id);
create index if not exists works_license               on public.works (license_id);
