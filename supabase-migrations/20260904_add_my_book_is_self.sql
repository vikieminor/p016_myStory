alter table public.my_books
  add column if not exists is_self boolean not null default false;
