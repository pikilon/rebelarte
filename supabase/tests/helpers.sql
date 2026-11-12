-- Utilidades de prueba (schema t). Se cargan una vez; no forman parte de las migraciones.
create schema t;
grant usage on schema t to public;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok   - %', msg;
end $$;

create function t.eq(a anyelement, b anyelement, msg text) returns void language plpgsql as $$
begin
  if a is distinct from b then raise exception 'FAIL: % (obtenido %, esperado %)', msg, a, b; end if;
  raise notice 'ok   - %', msg;
end $$;

-- Cambia de usuario simulando un JWT de Supabase.
create function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
-- Vuelve al propietario (superusuario), sin claims.
create function t.owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Cuenta filas de una consulta con los privilegios actuales.
create function t.n(q text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || q || ') s' into v;
  return v;
end $$;

-- Valor escalar de una consulta, como texto.
create function t.v(q text) returns text language plpgsql as $$
declare v text;
begin
  execute 'select (' || q || ')::text' into v;
  return v;
end $$;

-- Ejecuta una sentencia; debe fallar y el mensaje (o SQLSTATE) debe contener `expected`.
-- El rol vuelve solo al estado anterior porque el fallo revierte la subtransacción.
create function t.fails(q text, expected text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ilike '%' || expected || '%' or sqlstate = expected then
      raise notice 'ok   - % (%)', msg, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % (error inesperado: % [%])', msg, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL: % (no falló)', msg;
end $$;

-- Ejecuta una sentencia con UPDATE/DELETE ... y devuelve filas afectadas.
create function t.rows(q text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute q;
  get diagnostics v = row_count;
  return v;
end $$;

-- Crea un usuario con perfil directamente (como propietario).
create function t.mkuser(uid uuid, p_alias text, p_name text) returns void language plpgsql as $$
begin
  insert into auth.users (id, email) values (uid, p_alias || '@example.invalid');
  insert into public.profiles (id, alias, display_name) values (uid, p_alias, p_name);
end $$;

-- Usuarios fijos de las pruebas
create function t.alice() returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
create function t.bob()   returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000002'::uuid $$;
create function t.carol() returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000003'::uuid $$;
create function t.mod()   returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000004'::uuid $$;
create function t.dave()  returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000005'::uuid $$;

-- alice, bob, carol, dave (usuarios) y mod (moderador)
create function t.setup() returns void language plpgsql as $$
begin
  perform t.mkuser(t.alice(), 'alice', 'Alice Prueba');
  perform t.mkuser(t.bob(),   'bob',   'Bob Prueba');
  perform t.mkuser(t.carol(), 'carol', 'Carol Prueba');
  perform t.mkuser(t.dave(),  'dave',  'Dave Prueba');
  perform t.mkuser(t.mod(),   'moder', 'Moderadora Prueba');
  update public.profiles set role = 'moderator' where id = t.mod();
end $$;

-- Atajo: crea obra del usuario actual (debe estar logueado) y devuelve su id.
create function t.mkwork(p_title text, p_status text default 'published', p_vis text default 'public',
                         p_branch text default 'plasticas') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.works (uploader_id, branch, title, lang, status, visibility)
  values (auth.uid(), p_branch, jsonb_build_object('es', p_title), 'es', p_status, p_vis)
  returning id into v;
  return v;
end $$;
