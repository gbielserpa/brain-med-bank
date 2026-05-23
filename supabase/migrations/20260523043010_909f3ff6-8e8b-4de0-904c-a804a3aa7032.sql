
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy "Public can view question images" on storage.objects;

create policy "Authenticated can view question images"
on storage.objects for select
to authenticated
using (bucket_id = 'question-images');

create policy "Anon can read question images by path"
on storage.objects for select
to anon
using (bucket_id = 'question-images' and name like '%/%');
