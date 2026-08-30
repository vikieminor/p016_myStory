alter table public.questions
  add column if not exists description text not null default '';
