-- El Centro también alquila los sábados.
--
-- `dia_semana` cuenta con lunes en 0, así que el sábado es el 5: la restricción
-- pasa de 0..4 a 0..5. El domingo sigue afuera.
--
-- Las salas arrancan con el mismo horario que el resto de la semana. Si el
-- sábado abre distinto, se le cambia la hora a cada sala desde la tabla de
-- Espacios, que es donde hoy se edita el horario.

alter table public.apertura drop constraint if exists apertura_dia_semana_check;
alter table public.apertura add constraint apertura_dia_semana_check
  check (dia_semana between 0 and 5);

alter table public.contratos drop constraint if exists contratos_dia_semana_check;
alter table public.contratos add constraint contratos_dia_semana_check
  check (dia_semana between 0 and 5);

-- Cada sala abre el sábado en su mismo horario de la semana.
insert into public.apertura (espacio_id, dia_semana, desde_hora, hasta_hora)
select a.espacio_id, 5, a.desde_hora, a.hasta_hora
  from public.apertura a
 where a.dia_semana = 0
on conflict (espacio_id, dia_semana) do nothing;

select e.nombre, count(*) as dias, min(a.desde_hora) as abre, max(a.hasta_hora) as cierra
  from public.apertura a join public.espacios e on e.id = a.espacio_id
 group by e.nombre order by e.nombre;
