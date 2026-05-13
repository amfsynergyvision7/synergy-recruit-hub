create or replace function public.sync_google_integration_mapping()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.column_mapping := coalesce(new.column_mapping, '{}'::jsonb);
  new.mapping := coalesce(new.mapping, '{}'::jsonb);

  if tg_op = 'INSERT' then
    if new.mapping = '{}'::jsonb and new.column_mapping <> '{}'::jsonb then
      new.mapping := new.column_mapping;
    elsif new.column_mapping = '{}'::jsonb and new.mapping <> '{}'::jsonb then
      new.column_mapping := new.mapping;
    end if;
  else
    if new.mapping = '{}'::jsonb and new.column_mapping <> '{}'::jsonb then
      new.mapping := new.column_mapping;
    elsif new.column_mapping = '{}'::jsonb and new.mapping <> '{}'::jsonb then
      new.column_mapping := new.mapping;
    elsif new.mapping is distinct from old.mapping and new.column_mapping is not distinct from old.column_mapping then
      new.column_mapping := new.mapping;
    elsif new.column_mapping is distinct from old.column_mapping and new.mapping is not distinct from old.mapping then
      new.mapping := new.column_mapping;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;