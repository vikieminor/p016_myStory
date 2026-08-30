create table if not exists public.question_book_types (
  question_id bigint not null references public.questions(id) on delete cascade,
  book_type_id bigint not null references public.book_types(id) on delete cascade,
  primary key (question_id, book_type_id)
);

create index if not exists question_book_types_question_id_idx on public.question_book_types(question_id);
create index if not exists question_book_types_book_type_id_idx on public.question_book_types(book_type_id);

-- 기존 질문은 기존 북타입에서 계속 보이도록 초기 연결을 보존한다.
insert into public.question_book_types (question_id, book_type_id)
select q.id, b.id
from public.questions q cross join public.book_types b
where not exists (select 1 from public.question_book_types);
