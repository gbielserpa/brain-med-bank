
update storage.buckets set public = false where id = 'question-images';

drop policy if exists "Authenticated can view question images" on storage.objects;
drop policy if exists "Anon can read question images by path" on storage.objects;

create policy "Users view own question images"
on storage.objects for select
to authenticated
using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);
