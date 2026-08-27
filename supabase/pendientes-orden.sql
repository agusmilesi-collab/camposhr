-- Los temas de la próxima reunión se ordenan a mano.
--
-- Se listaban por antigüedad, que es el orden en que se fueron anotando y no
-- el orden en que conviene hablarlos: un tema que entró último puede ser el
-- que abre la reunión. Arrastrando la fila se cambia `orden`, y el que no lo
-- tiene queda al final, en el orden de siempre.
--
-- Las tareas no lo usan: su prioridad es la fecha en que vencen, y dos criterios
-- para la misma lista terminan contradiciéndose.
alter table public.pendientes
  add column if not exists orden integer;

comment on column public.pendientes.orden is
  'Posición del tema en la lista de la reunión, arrastrando. Null: al final, por antigüedad.';
