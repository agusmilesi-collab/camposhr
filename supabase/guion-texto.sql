-- El guion del expositor, un texto por presentación.
--
-- Reemplaza a `guion_notas`, que guardaba una nota por placa. La correspondencia
-- placa por placa obligaba a mantener dos lugares en sincronía (el deck y la
-- base) y a numerar a mano lo que se quería decir; para escribir el guion de una
-- charla alcanza con un texto corrido que se lee de arriba abajo.
--
-- Las notas que viajan adentro del deck (`data-notas`) siguen como están y son
-- las que se ven en su ventana de notas: son dos cosas distintas y ninguna pisa
-- a la otra.

begin;

create table if not exists public.guiones (
  token      text primary key,
  texto      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.guiones enable row level security;

drop table if exists public.guion_notas;

commit;
