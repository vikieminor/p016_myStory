-- A slot time may be shared by multiple authors. Daily occupancy is determined by moment_entries.
alter table public.moment_time_slots
  drop constraint if exists moment_time_slots_slot_time_key;

drop index if exists public.moment_time_slots_slot_time_key;

create unique index if not exists moment_time_slots_author_id_key
  on public.moment_time_slots(author_id);
