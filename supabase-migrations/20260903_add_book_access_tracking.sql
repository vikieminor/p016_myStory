-- 직접 만든 책도 Dashboard에서 접속률을 계산할 수 있도록 마지막 접속 시각을 저장한다.
alter table public.my_books add column if not exists last_accessed_at timestamptz;
create index if not exists my_books_last_accessed_at_idx on public.my_books(last_accessed_at);
