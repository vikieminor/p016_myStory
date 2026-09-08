-- my_books.owner_id remains the gift creator. This nullable field identifies
-- the Auth account that claimed the recipient side of a gift.
alter table public.gifts
  add column if not exists recipient_user_id uuid references auth.users(id) on delete set null;

create index if not exists gifts_recipient_user_id_idx
  on public.gifts(recipient_user_id);
