-- Cómo la persona ordena lo que dice, que es la otra vía del modelo.
--
-- El plazo y las cuatro preguntas se contestan sobre el trabajo que la persona
-- tiene asignado, así que miden hasta dónde la dejaron llegar. La capacidad se
-- lee en el discurso: cinco minutos sobre un tema que ella elija, y lo que se
-- mira es cómo arma el argumento (Gillian Stamp, sobre el modelo de Jaques).
--
--   discurso_modo: declarativo, acumulativo, serial o paralelo.
--   discurso_abstracto: los mismos cuatro modos, pero sobre conceptos y no
--   sobre cosas concretas. Es el orden siguiente de complejidad y corre cuatro
--   estratos para arriba.
alter table analisis_discursivo
  add column if not exists discurso_modo text,
  add column if not exists discurso_abstracto boolean not null default false;

alter table analisis_discursivo
  drop constraint if exists analisis_discursivo_discurso_modo_check;

alter table analisis_discursivo
  add constraint analisis_discursivo_discurso_modo_check
  check (discurso_modo is null or discurso_modo in ('declarativo', 'acumulativo', 'serial', 'paralelo'));

comment on column analisis_discursivo.discurso_modo is
  'Modo de procesamiento leído en cinco minutos de discurso libre: declarativo, acumulativo, serial o paralelo.';
comment on column analisis_discursivo.discurso_abstracto is
  'El mismo modo, sobre conceptos en vez de cosas concretas: corre el estrato cuatro escalones para arriba.';
