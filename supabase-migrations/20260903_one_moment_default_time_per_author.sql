-- Keep one reusable default-time row per author while preserving historical entry times.
alter table public.moment_entries
  add column if not exists slot_time time;

update public.moment_entries entries
set slot_time = slots.slot_time
from public.moment_time_slots slots
where entries.slot_id = slots.id
  and entries.slot_time is null;

alter table public.moment_entries
  alter column slot_time set not null;

drop index if exists public.moment_time_slots_author_time_key;
alter table public.moment_time_slots
  drop constraint if exists moment_time_slots_slot_time_key;

do $$
declare
  duplicate_row record;
  canonical_id bigint;
begin
  for duplicate_row in
    select author_id, array_agg(id order by created_at desc, id desc) as ids
    from public.moment_time_slots
    group by author_id
    having count(*) > 1
  loop
    canonical_id := duplicate_row.ids[1];
    update public.moment_entries
    set slot_id = canonical_id
    where slot_id = any(duplicate_row.ids[2:]);
    delete from public.moment_time_slots
    where id = any(duplicate_row.ids[2:]);
  end loop;
end $$;

create unique index if not exists moment_time_slots_author_id_key
  on public.moment_time_slots(author_id);
