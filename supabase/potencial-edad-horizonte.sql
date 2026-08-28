-- Los dos datos que ubican a la persona en el diagrama de progreso potencial.
--
-- Van en `analisis_discursivo` y no en `evaluaciones` porque son parte de esa
-- lectura: los carga la evaluadora junto con el estrato y solo existen en las
-- baterías que llevan el análisis.
--
-- La edad se repite a propósito. `evaluaciones.edad` es la que se congeló el
-- día de la entrevista a partir de la fecha de nacimiento, y no todos la
-- tienen: el diagrama necesita una sí o sí, así que acá se puede escribir a
-- mano. Cuando está la de la evaluación, esta arranca con ese valor.
--
-- El horizonte va en días y no en meses: la escalera del modelo empieza en un
-- día y termina en cincuenta años, y en meses el primer escalón no existe.
alter table analisis_discursivo
  add column if not exists edad smallint,
  add column if not exists horizonte_dias integer;

comment on column analisis_discursivo.edad is
  'Edad usada en el diagrama de progreso potencial. Arranca de evaluaciones.edad y se puede corregir a mano.';
comment on column analisis_discursivo.horizonte_dias is
  'Horizonte temporal que le atribuye la evaluadora, en días. Es el eje vertical del diagrama.';
