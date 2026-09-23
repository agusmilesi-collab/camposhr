-- Tipo de actividad nuevo: elegir algunas opciones en orden de prioridad.
--
-- Lo usa la última pregunta de la encuesta de John Deere: de cinco temas de
-- liderazgo, cada uno elige tres y en orden, así deja dos afuera sí o sí. Cuántas
-- se eligen va en `config.elegir`.

alter table public.actividades drop constraint if exists actividades_tipo_check;
alter table public.actividades add constraint actividades_tipo_check
  check (tipo in ('palabra','opcion','escala','texto','marcas','enlace',
                  'cuestionario','cruce','plan','ensayo','frases','campos',
                  'monedas','reparto','prioridad'));
