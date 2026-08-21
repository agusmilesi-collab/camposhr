-- De dónde salió el puntaje del Raven.
--
-- Entra por dos caminos: lo escribe el test cuando la persona lo termina por
-- su enlace, o lo carga la evaluadora cuando el Raven se tomó en papel. Los dos
-- guardan en la misma fila, así que sin esta columna la ficha muestra un número
-- sin poder decir cuál de los dos fue.
--
-- No alcanza con mirar si existe una sesión terminada: una evaluadora puede
-- cargar un puntaje a mano sobre alguien que además rindió por su enlace, y ahí
-- la sesión existe pero el número no salió de ella.
--
-- Las filas anteriores a esta columna quedan en null, que se lee como "no se
-- sabe" y no como ninguno de los dos.

alter table raven add column if not exists origen text
  check (origen in ('test', 'manual'));

comment on column raven.origen is
  'test = lo escribió el test por el enlace; manual = lo cargó la evaluadora.';
