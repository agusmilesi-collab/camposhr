-- En qué orden se le toman los tests a esta persona (25/8/2026).
--
-- La hoja de la entrevista los listaba en el orden en que están declarados en
-- la batería, que es el mismo para todos. Pero el orden lo decide quien toma:
-- si la persona llega tensa conviene empezar por el gráfico, si hay poco tiempo
-- se manda el Raven primero para que corra mientras se hace otra cosa.
--
-- Se guarda por evaluación y no por evaluadora: la decisión es sobre esta
-- entrevista. Lo que no esté en la lista va al final, en el orden de la
-- batería, así sumar un test a la batería no lo esconde.

alter table public.evaluaciones add column if not exists orden_tests text[];

comment on column public.evaluaciones.orden_tests is
  'Orden elegido para la hoja de entrevista. Null: el de la batería.';
