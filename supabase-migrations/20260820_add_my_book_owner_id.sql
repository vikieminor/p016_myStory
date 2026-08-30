alter table public.my_books
  add column if not exists owner_id uuid references auth.users(id);

create index if not exists my_books_owner_id_idx
  on public.my_books(owner_id);
