-- Quién puso la plata de un gasto.
--
-- El trabajo se reparte entre los tres, pero los gastos los adelanta uno: las
-- resmas las pagó una, el combustible otro. Al repartir, cada uno recupera lo
-- que puso antes de partir lo que queda, así que el gasto tiene que saber de
-- quién fue el bolsillo.
--
-- Guarda el nombre tal como figura en `public.equipo` y no una referencia: el
-- equipo cambia poco y un gasto viejo tiene que seguir diciendo quién lo pagó
-- aunque esa persona ya no esté.
--
-- Nulo es lo que vale para todo lo ya cargado y para lo que paga el estudio:
-- ese gasto se resta del pozo igual, pero no se le devuelve a nadie.
alter table public.costos
  add column if not exists pagado_por text;

comment on column public.costos.pagado_por is
  'Quién puso la plata: nombre de public.equipo. Nulo si lo pagó el estudio o todavía no se sabe.';
