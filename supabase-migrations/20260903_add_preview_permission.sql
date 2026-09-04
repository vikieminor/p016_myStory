-- 선물한 사람의 미리보기 허용 여부를 작성 권한과 분리해 저장한다.
alter table public.my_books add column if not exists preview_allowed boolean not null default false;
