-- Lo que la evaluadora dice del potencial, con sus palabras.
--
-- El instrumento compara dos números y elige una conclusión escrita de
-- antemano. Eso está bien y no lleva nada de interpretación, pero deja al
-- capítulo de potencial como el único del informe que se publica sin una línea
-- de quien lo firma: la recomendación lleva su fundamentación, las cuatro
-- listas del análisis las puede reescribir, y esto no tenía nada.
--
--   fundamentacion: por qué ubicó a la persona en ese estrato, en primera
--   persona. Va al informe con su firma, como la de la recomendación.
--
--   subutilizado: el instrumento mide el alcance del trabajo que la persona
--   tiene asignado hoy, y eso no es lo mismo que hasta dónde puede llegar. Un
--   puesto que no la exige devuelve un estrato bajo y no dice por qué. Con esta
--   marca, quien lee el informe sabe que el número describe al puesto y no a la
--   persona.
alter table analisis_discursivo
  add column if not exists fundamentacion text,
  add column if not exists subutilizado boolean not null default false;

comment on column analisis_discursivo.fundamentacion is
  'Por qué la evaluadora ubicó a la persona en ese estrato, en primera persona. Sale en el informe.';
comment on column analisis_discursivo.subutilizado is
  'El puesto actual de la persona no le exige lo que puede: el estrato mide lo asignado, no el techo.';
