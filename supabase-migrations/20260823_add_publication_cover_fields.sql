-- 출판물의 선택 표지 정보를 저장하기 위한 migration
-- 기존 publications 데이터는 변경하지 않습니다.

alter table public.publications
  add column if not exists cover_color text;

alter table public.publications
  add column if not exists cover_image text;
