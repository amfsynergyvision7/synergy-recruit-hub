drop trigger if exists set_candidate_sync_defaults_trigger on public.candidates;

create trigger set_candidate_sync_defaults_trigger
before insert on public.candidates
for each row
execute function public.set_candidate_sync_defaults();