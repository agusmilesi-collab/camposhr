-- Tareas que vuelven cada semana (20/10/2026).
--
-- `repite_dia` es el día de la semana en que la tarea reaparece (0 domingo a
-- 6 sábado). Null es una tarea común. Una que se repite está escondida hasta
-- su `vence`; marcada hecha, vuelve a Pendiente el mismo día de la semana
-- siguiente, con `vence` corrido a ese día (lo hace `lib/pendientes.ts` al
-- leer). Primer uso: facturar Federada una vez por semana, los jueves.
alter table public.pendientes
  add column if not exists repite_dia smallint check (repite_dia between 0 and 6);
