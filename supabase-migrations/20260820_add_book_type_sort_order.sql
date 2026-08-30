alter table public.book_types
  add column if not exists sort_order integer not null default 1;

update public.book_types
set sort_order = id
where sort_order = 1;

alter table public.book_types
  drop constraint if exists book_types_sort_order_check;

alter table public.book_types
  add constraint book_types_sort_order_check check (sort_order >= 1);
