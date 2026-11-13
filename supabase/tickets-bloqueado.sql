-- Un ticket puede quedar Bloqueado: no se puede avanzar hasta que alguien
-- resuelva algo de afuera (una respuesta, un dato, una decisión).
alter table public.tickets drop constraint if exists tickets_estado_check;
alter table public.tickets
  add constraint tickets_estado_check
  check (estado in ('Nuevo', 'En curso', 'Bloqueado', 'Hecho', 'Descartado'));
