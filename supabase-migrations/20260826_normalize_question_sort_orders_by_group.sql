with ranked as (
  select id,
         row_number() over (partition by question_group_id order by sort_order nulls last, id) as next_sort_order
  from public.questions
)
update public.questions q
set sort_order = ranked.next_sort_order,
    updated_at = now()
from ranked
where q.id = ranked.id
  and q.sort_order is distinct from ranked.next_sort_order;
