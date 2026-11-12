-- 09 · Storage: buckets y políticas
--
-- Buckets públicos (las URL se sirven sin política de lectura; la lectura por
-- API la damos solo al propietario, para que `upsert` funcione y no se pueda
-- listar el contenido ajeno). Límites según src/lib/types.ts (LIMITS):
--   imágenes 10 MB · PDF 20 MB · ZIP 10 MB · audio 30 MB.
-- El bucket `docs` mezcla PDF y ZIP: su límite es el mayor (20 MB); el de 10 MB
-- para ZIP lo impone el CHECK de attachments.size_bytes.
-- Rutas: <user_id>/<work_id>/<uuid>.<ext> (miniaturas: sufijo -thumb.webp).
-- Las obras privadas usan rutas con uuid no adivinable; se acepta que el archivo
-- sea accesible a quien conozca la URL (arquitectura §4 Storage).
-- Las miniaturas de PDF/ZIP se suben al bucket `images` (carpeta propia).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('images',  'images',  true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('docs',    'docs',    true, 20971520, array['application/pdf', 'application/zip', 'application/x-zip-compressed']),
  ('audio',   'audio',   true, 31457280, array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav',
                                                 'audio/x-wav', 'audio/webm', 'audio/flac', 'audio/x-m4a']),
  ('avatars', 'avatars', true,  5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Escritura solo en la carpeta propia: el primer segmento de la ruta es el uid.
create policy "rebelarte_storage_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id in ('images', 'docs', 'audio', 'avatars')
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_active_user());

create policy "rebelarte_storage_select_own" on storage.objects for select to authenticated
  using (bucket_id in ('images', 'docs', 'audio', 'avatars')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "rebelarte_storage_update_own" on storage.objects for update to authenticated
  using (bucket_id in ('images', 'docs', 'audio', 'avatars')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('images', 'docs', 'audio', 'avatars')
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_active_user());

-- Borrar: el dueño, y moderación (retirada de contenido infractor).
create policy "rebelarte_storage_delete_own" on storage.objects for delete to authenticated
  using (bucket_id in ('images', 'docs', 'audio', 'avatars')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator()));
