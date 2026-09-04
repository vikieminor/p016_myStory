-- A time is reusable across authors and dates; actual entries enforce daily occupancy.
alter table public.moment_time_slots
  drop constraint if exists moment_time_slots_slot_time_key;

create unique index if not exists moment_time_slots_author_time_key
  on public.moment_time_slots(author_id, slot_time);
