-- La escala pasa a ser de cada sala, no de una categoría compartida.
--
-- La categoría (A para los consultorios 1, 3 y 4; B para el 2) servía para no
-- repetir los mismos seis números tres veces, pero convertía la tabla de
-- precios en algo que no se puede editar donde se lee: tocar el precio del
-- consultorio 1 cambiaba también el del 3 y el del 4, sin decirlo.
--
-- Con una escala por sala, cada celda de esa tabla es lo que dice ser. Dos
-- salas que valen lo mismo tienen los mismos números, y el aumento por
-- porcentaje sigue alcanzándolas a todas de una vez, que era lo único que la
-- categoría ahorraba de verdad.

alter table public.tarifas add column if not exists espacio_id uuid references public.espacios (id) on delete cascade;

-- La clave vieja se cae antes de copiar: cinco salas sobre tres categorías
-- repiten la combinación que esa clave prohíbe.
alter table public.tarifas drop constraint if exists tarifas_categoria_horas_semana_desde_desde_key;

-- Cada sala hereda la escala de la categoría que tenía.
insert into public.tarifas (espacio_id, categoria, horas_semana_desde, precio_hora, desde)
select e.id, t.categoria, t.horas_semana_desde, t.precio_hora, t.desde
  from public.espacios e
  join public.tarifas t on t.categoria = e.categoria and t.espacio_id is null;

delete from public.tarifas where espacio_id is null;

alter table public.tarifas alter column espacio_id set not null;
alter table public.tarifas alter column categoria drop not null;

-- La clave única mira la sala.
create unique index if not exists tarifas_sala_tramo_desde_idx
  on public.tarifas (espacio_id, horas_semana_desde, desde);

comment on column public.tarifas.espacio_id is
  'La sala. Cada una tiene su escala: la tabla de precios se edita donde se lee.';
comment on column public.tarifas.categoria is
  'Queda de la escala vieja, compartida por categoría. No se usa.';

select e.nombre, count(*) as tramos from public.tarifas t
  join public.espacios e on e.id = t.espacio_id
 group by e.nombre order by e.nombre;
