-- Dónde cae dentro de su estrato: A, B o C.
--
-- Cada estrato del modelo se subdivide en tres celdas, que son las que la
-- lámina rotula en su columna: A arriba, M en el medio y B abajo, así que IIM
-- es la parte del medio del estrato II. El original de Jaques las llama A, B y
-- C; acá se dicen por lo que significan.
--
-- Reemplaza a la marca de transición: estar en A es justamente estar en el
-- borde de arriba, a punto de pasar al estrato siguiente, y decirlo con la
-- celda es decirlo con la grilla del propio modelo.
alter table analisis_discursivo
  add column if not exists discurso_celda text;

alter table analisis_discursivo
  drop constraint if exists analisis_discursivo_discurso_celda_check;

alter table analisis_discursivo
  add constraint analisis_discursivo_discurso_celda_check
  check (discurso_celda is null or discurso_celda in ('A', 'M', 'B'));

alter table analisis_discursivo
  drop column if exists discurso_transicion;

comment on column analisis_discursivo.discurso_celda is
  'Dónde cae dentro de su estrato: A alto, M medio, B bajo. Sin valor se lee como M.';
