-- Perfiles: alta, alias, visibilidad de campos, columnas protegidas
insert into auth.users (id, email) values (t.alice(), 'a@example.invalid'), (t.bob(), 'b@example.invalid'),
  (t.carol(), 'c@example.invalid');

-- anónimo no puede crear perfil
select t.anon();
select t.fails($$select public.create_profile('anon-user', 'Anon', 'es')$$, 'permission denied', 'anon no puede llamar a create_profile');

-- alta correcta (el alias se normaliza a minúsculas)
select t.login(t.alice());
select t.eq((select alias::text from public.create_profile('Alice-Demo', 'Alice Demo', 'es')), 'alice-demo', 'create_profile normaliza el alias');
select t.fails($$select public.create_profile('otra', 'X', 'es')$$, 'profile_exists', 'no se puede crear un segundo perfil');

-- alias inválidos y reservados
select t.login(t.bob());
select t.fails($$select public.create_profile('ab', 'Bob', 'es')$$, 'invalid_alias', 'alias demasiado corto');
select t.fails($$select public.create_profile('-bob', 'Bob', 'es')$$, 'invalid_alias', 'alias empieza por guion');
select t.fails($$select public.create_profile('bob_x', 'Bob', 'es')$$, 'invalid_alias', 'alias con carácter no permitido');
select t.fails($$select public.create_profile('mi', 'Bob', 'es')$$, 'invalid_alias', 'alias de 2 letras inválido');
select t.fails($$select public.create_profile('moderacion', 'Bob', 'es')$$, 'reserved_alias', 'alias reservado moderacion');
select t.fails($$select public.create_profile('admin', 'Bob', 'es')$$, 'reserved_alias', 'alias reservado admin');
select t.fails($$select public.create_profile('buscar', 'Bob', 'es')$$, 'reserved_alias', 'alias reservado buscar');
select t.fails($$select public.create_profile('bobby', '  ', 'es')$$, 'invalid_name', 'nombre vacío');
select t.fails($$select public.create_profile('bobby', 'Bob', 'fr')$$, 'invalid_lang', 'idioma no soportado');
select t.fails($$select public.create_profile('ALICE-demo', 'Bob', 'es')$$, 'alias_taken', 'alias duplicado sin distinguir mayúsculas');
select t.ok((select alias::text from public.create_profile('bobby', 'Bob Prueba', 'en')) = 'bobby', 'bob crea su perfil');

-- sin sesión de usuario nuevo (carol aún sin perfil) no puede escribir
select t.login(t.carol());
select t.fails($$insert into public.works (uploader_id, branch, title, lang) values (auth.uid(), 'plasticas', '{"es":"x"}', 'es')$$,
  'violates', 'sin perfil no se pueden crear obras');
select t.fails($$select public.request_participation(gen_random_uuid(), '[{"role_text":"x"}]')$$, 'profile_required', 'sin perfil no hay participaciones');

-- columnas protegidas
select t.login(t.alice());
select t.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied', 'no puede cambiar su rol');
select t.fails($$update public.profiles set status = 'active' where id = auth.uid()$$, 'permission denied', 'no puede cambiar su status');
select t.fails($$update public.profiles set short_id = 'AAAAAAAA' where id = auth.uid()$$, 'permission denied', 'no puede cambiar su short_id');
select t.fails($$insert into public.profiles (id, alias, display_name) values (gen_random_uuid(), 'hacker', 'H')$$, 'permission denied', 'no hay insert directo en profiles');
select t.eq(t.rows($$update public.profiles set display_name = 'Alice Renombrada' where id = auth.uid()$$), 1::bigint, 'puede editar su nombre');
select t.eq(t.rows($$update public.profiles set display_name = 'Hack' where id <> auth.uid()$$), 0::bigint, 'no puede editar perfiles ajenos');
select t.eq(t.n($$select 1 from public.profiles$$), 1::bigint, 'solo ve su propia fila en profiles');
select t.ok(length((select short_id from public.profiles where id = auth.uid())) = 8, 'short_id de 8 caracteres');
select t.fails($$update public.profiles set field_visibility = '{"foo":"public"}' where id = auth.uid()$$, 'check', 'field_visibility con clave desconocida');

-- vista pública: columnas seguras y solo lectura
select t.anon();
select t.eq(t.n($$select 1 from public.profiles_public$$), 2::bigint, 'profiles_public lista los perfiles activos');
select t.fails($$select contact_email from public.profiles_public$$, 'does not exist', 'profiles_public no expone contact_email');
select t.fails($$update public.profiles_public set display_name = 'x'$$, 'permission denied', 'profiles_public no es actualizable');
select t.fails($$select * from public.profiles$$, 'permission denied', 'anon no lee profiles');

-- visibilidad de campos en profile_public
select t.login(t.alice());
update public.profiles set
  location = 'Córdoba', contact_email = 'alice@example.invalid', show_email = true,
  cover_letter = '{"es": "Carta de Alice"}', rate_text = '{"es": "Tarifa"}', rate_price = '50 EUR/h',
  field_visibility = '{"location": "registered", "contact_email": "registered", "cover_letter": "private", "rate": "public"}'
where id = auth.uid();

select t.anon();
select t.ok((select location is null and contact_email is null and cover_letter is null and rate_price = '50 EUR/h'
             from public.profile_public('ALICE-demo')), 'anónimo: registered y private ocultos, public visible');
select t.eq((select display_name from public.profile_public('alice-demo')), 'Alice Renombrada', 'profile_public busca sin distinguir mayúsculas');
select t.eq(t.n($$select 1 from public.profile_public('no-existe')$$), 0::bigint, 'alias inexistente devuelve 0 filas');

select t.login(t.bob());
select t.ok((select location = 'Córdoba' and contact_email = 'alice@example.invalid' and cover_letter is null
             from public.profile_public('alice-demo')), 'registrado: ve registered, no ve private');

select t.login(t.alice());
select t.ok((select location = 'Córdoba' and contact_email is not null and cover_letter->>'es' = 'Carta de Alice'
             from public.profile_public('alice-demo')), 'dueño: ve todo');

-- show_email = false oculta el correo aunque la visibilidad lo permita
update public.profiles set show_email = false where id = auth.uid();
select t.login(t.bob());
select t.ok((select contact_email is null from public.profile_public('alice-demo')), 'show_email=false oculta el correo a terceros');
select t.login(t.alice());
select t.ok((select contact_email is not null from public.profile_public('alice-demo')), 'el dueño sigue viendo su correo');

-- suspendido: oculto en la vista y en profile_public, y no puede editar
select t.owner();
update public.profiles set status = 'suspended' where id = t.alice();
select t.anon();
select t.eq(t.n($$select 1 from public.profiles_public where alias = 'alice-demo'$$), 0::bigint, 'suspendido fuera de profiles_public');
select t.eq(t.n($$select 1 from public.profile_public('alice-demo')$$), 0::bigint, 'suspendido fuera de profile_public');
select t.login(t.alice());
select t.fails($$update public.profiles set display_name = 'Sigo escribiendo' where id = auth.uid()$$, 'row-level security', 'suspendido no edita su perfil');

-- CV: visibilidad por entrada
select t.owner();
update public.profiles set status = 'active' where id = t.alice();
select t.login(t.alice());
insert into public.cv_entries (profile_id, kind, title, visibility) values
  (auth.uid(), 'education', '{"es":"Pública"}', 'public'),
  (auth.uid(), 'course', '{"es":"Registrados"}', 'registered'),
  (auth.uid(), 'other', '{"es":"Privada"}', 'private');
select t.eq(t.n($$select 1 from public.cv_entries$$), 3::bigint, 'dueño ve las 3 entradas del CV');
select t.anon();
select t.eq(t.n($$select 1 from public.cv_entries$$), 1::bigint, 'anónimo ve solo la pública');
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.cv_entries$$), 2::bigint, 'registrado ve pública y registered');
select t.fails($$insert into public.cv_entries (profile_id, kind, title) values (t.alice(), 'other', '{"es":"x"}')$$, 'row-level security', 'no se escribe en el CV ajeno');

-- adjuntos del CV: máx. 6
select t.login(t.alice());
do $$
declare i int;
begin
  for i in 1..6 loop
    insert into public.profile_attachments (profile_id, kind, path, mime, size_bytes)
    values (auth.uid(), 'image', auth.uid() || '/cv/' || i || '.webp', 'image/webp', 1000);
  end loop;
  perform t.fails(format($q$insert into public.profile_attachments (profile_id, kind, path, mime, size_bytes) values (%L, 'image', %L, 'image/webp', 1000)$q$,
    auth.uid(), auth.uid() || '/cv/7.webp'), 'attachment_limit', 'séptimo adjunto de CV rechazado');
end $$;
