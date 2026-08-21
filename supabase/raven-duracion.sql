-- Cuánto tardó en responder el Raven.
--
-- El test dura 45 minutos como tope, pero muchos entregan antes, y cuánto
-- tardaron es dato: dos personas con el mismo puntaje no rindieron igual si una
-- terminó en veinte minutos y la otra usó el tiempo completo.
--
-- Se guarda junto al puntaje y no solo en la sesión, porque es lo que después
-- lee la ficha y el informe, y porque un puntaje cargado a mano no tiene
-- sesión: ahí queda en null, que se lee como "no se sabe".

alter table raven add column if not exists duracion_segundos integer;

comment on column raven.duracion_segundos is
  'Segundos entre la primera lámina y la entrega. Null si el puntaje se cargó a mano.';
