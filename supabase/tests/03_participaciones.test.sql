-- Participaciones: aceptación por defecto, rechazo parcial, retirada, invitados
select t.setup();
create temp table w (k text primary key, id uuid);
grant all on w to public;
select t.login(t.alice());
insert into w select 'pub', t.mkwork('Retrato');
insert into w select 'priv', t.mkwork('Privada', 'published', 'private');
create temp table ids (k text primary key, id uuid);
grant all on ids to public;
select t.v($$select id from role_catalog where slug='modelo'$$) as modelo \gset
select t.v($$select id from role_catalog where slug='fotografo'$$) as foto \gset

-- bob se apunta: aceptada + notificación al subidor
select t.login(t.bob());
insert into ids select 'bob', public.request_participation((select id from w where k='pub'),
  jsonb_build_array(jsonb_build_object('role_id', :modelo), jsonb_build_object('role_id', :foto), jsonb_build_object('role_text', 'Vestuario')));
select t.eq((select status from public.participations where id = (select id from ids where k='bob')), 'accepted', 'participación aceptada por defecto');
select t.eq(t.n($$select 1 from public.participation_roles where participation_id = (select id from ids where k='bob')$$), 3::bigint, 'tres cargos guardados');
select t.fails($$select public.request_participation((select id from w where k='pub'), '[{"role_text":"x"}]')$$, 'already_participating', 'no se duplica');
select t.fails($$select public.request_participation((select id from w where k='priv'), '[{"role_text":"x"}]')$$, 'work_not_found', 'no se puede pedir en obra privada');
select t.fails($$select public.request_participation((select id from w where k='pub'), '[]')$$, 'already_participating', 'ya participa');
select t.fails($$select public.set_participation_status((select id from ids where k='bob'), 'rejected')$$, 'forbidden', 'el participante no puede rechazarse a sí mismo vía rejected');
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.notifications where type='participation_new'$$), 1::bigint, 'notificación participation_new al subidor');
select t.eq((select payload->>'profile_alias' from public.notifications where type='participation_new'), 'bob', 'payload con alias');

-- terceros: roles rechazados no se ven; participación pública sí
select t.login(t.bob());
select t.fails($$select public.set_participation_role_status((select id from public.participation_roles where role_text='Vestuario'), 'rejected')$$, 'forbidden', 'solo el subidor rechaza cargos');
select t.login(t.alice());
select public.set_participation_role_status((select id from public.participation_roles where role_text='Vestuario'), 'rejected');
select t.eq((select status from public.participations where id = (select id from ids where k='bob')), 'accepted', 'rechazo parcial mantiene aceptada');
select t.anon();
select t.eq(t.n($$select 1 from public.participation_roles where participation_id = (select id from ids where k='bob')$$), 2::bigint, 'el público no ve el cargo rechazado');
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.participation_roles where participation_id = (select id from ids where k='bob')$$), 3::bigint, 'el titular sí lo ve');
select t.eq(t.n($$select 1 from public.notifications where type='participation_rejected'$$), 1::bigint, 'aviso de rechazo parcial');
select t.ok((select jsonb_array_length(roles) = 2 from public.cv_works(t.bob())), 'cv_works devuelve solo cargos aceptados');
select t.login(t.alice());
select public.set_participation_role_status(id, 'rejected') from public.participation_roles where participation_id = (select id from ids where k='bob') and status='accepted';
select t.eq((select status from public.participations where id = (select id from ids where k='bob')), 'rejected', 'todos los cargos rechazados => rejected');
select t.eq(t.n($$select 1 from public.cv_works(t.bob())$$), 0::bigint, 'ya no sale en el CV');
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.notifications where type='participation_rejected'$$), 3::bigint, 'aviso de rechazo total (más los parciales)');
select t.fails($$select public.request_participation((select id from w where k='pub'), '[{"role_text":"x"}]')$$, 'participation_rejected', 'rechazado no puede volver a pedir');

-- carol: retirada por el participante y reactivación
select t.login(t.carol());
insert into ids select 'carol', public.request_participation((select id from w where k='pub'), '[{"role_text":"Cámara"}]');
select public.set_participation_status((select id from ids where k='carol'), 'withdrawn');
select t.eq((select status from public.participations where id = (select id from ids where k='carol')), 'withdrawn', 'retirada por el participante');
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.notifications where type='participation_withdrawn'$$), 1::bigint, 'aviso de retirada al subidor');
select t.fails($$select public.set_participation_status((select id from ids where k='carol'), 'rejected')$$, 'invalid_transition', 'no se rechaza lo ya retirado');
select t.fails($$select public.set_participation_status((select id from participations where profile_id = t.alice() limit 1), 'rejected')$$, 'own_participation', 'el subidor no se rechaza a sí mismo');
select t.login(t.carol());
select public.request_participation((select id from w where k='pub'), '[{"role_text":"Iluminación"}]');
select t.eq((select status from public.participations where id = (select id from ids where k='carol')), 'accepted', 'reactivación tras retirada');
select t.eq(t.n($$select 1 from public.participation_roles where participation_id = (select id from ids where k='carol')$$), 1::bigint, 'cargos sustituidos');

-- invitación y participante sin cuenta
select t.login(t.alice());
select t.ok(public.invite_participant((select id from w where k='pub'), 'DAVE', '[{"role_text":"Asistente"}]') is not null, 'invitar por alias');
select t.login(t.dave());
select t.eq(t.n($$select 1 from public.notifications where type='participation_invited'$$), 1::bigint, 'notificación de invitación');
select t.login(t.bob());
select t.fails($$select public.invite_participant((select id from w where k='pub'), 'dave', '[{"role_text":"x"}]')$$, 'forbidden', 'solo el subidor invita');
select t.fails($$select public.add_guest_participant((select id from w where k='pub'), 'Invitada', '[{"role_text":"x"}]')$$, 'forbidden', 'solo el subidor añade invitados');
select t.login(t.alice());
select public.add_guest_participant((select id from w where k='pub'), 'Persona Sin Cuenta', ('[{"role_id": ' || :modelo || '}]')::jsonb) as code \gset
select t.ok(length(:'code') = 12, 'código de 12 caracteres');
select t.eq(t.n($$select 1 from public.participation_claims$$), 1::bigint, 'el subidor ve el código');
select t.ok((select claim_code = :'code' from public.participations_manage where guest_name = 'Persona Sin Cuenta'), 'participations_manage trae claim_code al subidor');
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.participation_claims$$), 0::bigint, 'un tercero no ve claim_code');
select t.ok((select claim_code is null from public.participations_manage where guest_name = 'Persona Sin Cuenta'), 'participations_manage oculta claim_code a terceros');
select t.anon();
select t.eq(t.n($$select 1 from public.participations where guest_name = 'Persona Sin Cuenta'$$), 1::bigint, 'invitada aparece en la lista pública');
select t.login(t.carol());
select t.fails($$select public.claim_participation('XXXXXXXXXXXX')$$, 'invalid_code', 'código inválido');
select t.login(t.dave());
select t.fails(format('select public.claim_participation(%L)', :'code'), 'already_participating', 'quien ya participa no puede reclamar otra');
select t.login(t.mod());
select public.claim_participation(lower(:'code')) is not null as ok \gset
select t.ok(:'ok', 'reclamar con código (sin distinguir mayúsculas)');
select t.ok((select profile_id = t.mod() and guest_name is null from public.participations where id = (select id from public.participations where profile_id = t.mod() and work_id = (select id from w where k='pub') limit 1)), 'queda enlazada');
select t.login(t.carol());
select t.fails($$select public.claim_participation('x')$$, 'invalid_code', 'el código es de un solo uso');

-- premio de obra en el CV de participantes
select t.login(t.alice());
insert into public.awards (id, name, year, lang, created_by) values ('20000000-0000-4000-8000-0000000000aa', '{"es":"Premio X"}', 2020, 'es', auth.uid());
insert into public.award_links (award_id, work_id, created_by) values ('20000000-0000-4000-8000-0000000000aa', (select id from w where k='pub'), auth.uid());
select t.anon();
select t.ok((select via_work_id = (select id from w where k='pub') from public.cv_awards(t.carol())), 'cv_awards: premio heredado de la obra');
select t.eq(t.n($$select 1 from public.cv_awards(t.bob())$$), 0::bigint, 'el rechazado no hereda el premio');
select t.eq(t.n($$select 1 from public.cv_awards(t.alice())$$), 1::bigint, 'el subidor también');

-- Jev: juez de cargos on-the-fly (catálogo, variantes de género, creación y rechazo)
select t.login(t.alice());
select t.eq((select (public.resolve_existing_or_cached_role('plasticas', 'Fotógrafa')->'role'->>'slug')), 'fotografo', 'Jev: variante femenina coincide con Fotógrafo/a');
select t.eq((select (public.resolve_existing_or_cached_role('audiovisuales', 'Actriz protagonista')->'role'->>'slug')), 'actor-protagonista', 'Jev: Actriz protagonista coincide con Actor/actriz protagonista');
select t.ok(public.resolve_existing_or_cached_role('audiovisuales', 'Colorista') is null, 'Jev: cargo nuevo sin evaluar devuelve null en caché');
select t.fails($$select public.record_role_judge_decision(t.alice(), 'audiovisuales', 'Colorista', 'approved_new', 'colorista', '{"es":"Colorista","en":"Colorist"}')$$, 'permission denied', 'Jev: cliente no puede invocar record_role_judge_decision directamente');

select t.owner();
select t.eq((select public.record_role_judge_decision(t.alice(), 'audiovisuales', 'Colorista', 'approved_new', 'colorista', '{"es":"Colorista","en":"Colorist"}', null, '{"es":"Cargo válido en posproducción audiovisual.","en":"Valid role in audiovisual post-production."}')->>'decision'), 'approved_new', 'Jev: aprueba y crea cargo nuevo on the fly');
select t.eq((select name->>'en' from public.role_catalog where branch = 'audiovisuales' and slug = 'colorista'), 'Colorist', 'Jev: cargo creado en role_catalog con traducción');
select t.eq((select public.record_role_judge_decision(t.alice(), 'textos', 'Foquista', 'rejected', null, null, null, '{"es":"Propio de audiovisuales.","en":"Belongs to audiovisuals."}')->>'decision'), 'rejected', 'Jev: registra rechazo con motivo');

select t.login(t.bob());
select t.eq((select public.resolve_existing_or_cached_role('audiovisuales', '  colorista ')->'role'->>'slug'), 'colorista', 'Jev: segundo usuario obtiene el cargo recién creado');
select t.eq((select public.resolve_existing_or_cached_role('textos', 'foquista')->>'decision'), 'rejected', 'Jev: caché devuelve el rechazo para esa rama');
select t.eq(t.n($$select 1 from public.role_judge_decisions$$), 0::bigint, 'Jev: RLS oculta decisiones de otros usuarios a un usuario normal');
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.role_judge_decisions$$), 2::bigint, 'Jev: el autor ve sus propias decisiones');
select t.login(t.mod());
select t.eq(t.n($$select 1 from public.role_judge_decisions$$), 2::bigint, 'Jev: moderación ve todas las decisiones');
