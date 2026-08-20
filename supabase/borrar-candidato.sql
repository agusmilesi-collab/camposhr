-- El registro de accesos anota también los borrados.
--
-- Un cambio y un borrado son dos cosas distintas y la auditoría tiene que
-- poder separarlas: lo que el registro debe contestar es quién sacó una
-- evaluación de la base y cuándo, y para eso necesita su propio valor.

alter table public.accesos drop constraint if exists accesos_accion_check;

alter table public.accesos
  add constraint accesos_accion_check
  check (accion in ('lectura', 'escritura', 'descarga', 'borrado'));
