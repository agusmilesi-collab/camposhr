-- Qué entrega cada batería. En Airtable es el campo "Outputs".
alter table public.baterias
  add column if not exists outputs text[] not null default '{}';
