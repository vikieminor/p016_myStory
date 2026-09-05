alter table public.questions
  add column if not exists template_type text not null default 'basic'
    check (template_type in ('basic', 'short-answer', 'image', 'short-answer-image', 'segmented'));

alter table public.questions
  add column if not exists template_config jsonb not null default '{}'::jsonb;

update public.questions
set template_type = 'basic'
where template_type is null or template_type = '';

update public.questions
set template_config = '{}'::jsonb
where template_config is null;
