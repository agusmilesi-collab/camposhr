-- Una tarea del equipo tiene estado y fecha de vencimiento.
--
-- Hasta ahora una tarea estaba hecha o no, y eso no distingue lo que nadie
-- empezó de lo que alguien ya tiene entre manos: en la reunión las dos se
-- leían igual y se volvían a repartir. `estado` es de tres valores y `hecha`
-- pasa a salir de él (Hecha), de un solo lado, para no tener dos verdades.
--
-- `vence` es la fecha en que la tarea deja de poder esperar. Puede faltar: hay
-- tareas que no tienen fecha, y eso no es lo mismo que una vencida hoy.
--
-- Los temas de la próxima reunión no usan ninguno de los dos, igual que no
-- usan responsable: un tema es del grupo hasta que se reparte, y repartirlo es
-- moverlo a la lista de tareas.
alter table public.pendientes
  add column if not exists estado text not null default 'Pendiente',
  add column if not exists vence date;

update public.pendientes set estado = 'Hecha' where hecha = true and estado = 'Pendiente';

alter table public.pendientes
  drop constraint if exists pendientes_estado_check;
alter table public.pendientes
  add constraint pendientes_estado_check
  check (estado in ('Pendiente', 'En curso', 'Hecha'));

comment on column public.pendientes.estado is
  'Pendiente, En curso o Hecha. Manda sobre hecha, que se escribe desde acá.';
comment on column public.pendientes.vence is
  'Cuándo deja de poder esperar. Null: sin fecha, que no es lo mismo que vencida.';
