
-- Questions table
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  statement text not null,
  image_url text,
  alternatives jsonb not null default '[]'::jsonb,
  correct_letter text not null,
  specialty text,
  institution text,
  year int,
  relevance int not null default 3 check (relevance between 1 and 5),
  explanation text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_user_id_idx on public.questions(user_id);
create index questions_specialty_idx on public.questions(specialty);

alter table public.questions enable row level security;

create policy "users select own questions" on public.questions for select using (auth.uid() = user_id);
create policy "users insert own questions" on public.questions for insert with check (auth.uid() = user_id);
create policy "users update own questions" on public.questions for update using (auth.uid() = user_id);
create policy "users delete own questions" on public.questions for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Exam attempts
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  total int not null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index exam_attempts_user_id_idx on public.exam_attempts(user_id);

alter table public.exam_attempts enable row level security;

create policy "users select own attempts" on public.exam_attempts for select using (auth.uid() = user_id);
create policy "users insert own attempts" on public.exam_attempts for insert with check (auth.uid() = user_id);
create policy "users delete own attempts" on public.exam_attempts for delete using (auth.uid() = user_id);

-- Storage bucket for question images
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "Public can view question images"
on storage.objects for select
using (bucket_id = 'question-images');

create policy "Users upload own question images"
on storage.objects for insert
with check (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own question images"
on storage.objects for update
using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own question images"
on storage.objects for delete
using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);
