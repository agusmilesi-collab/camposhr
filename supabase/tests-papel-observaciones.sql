-- Lo que la evaluadora anota del Bender y del gráfico de dos personas.
--
-- Los dos se toman en papel y no producen puntaje en el OS: lo único que queda
-- es si se administraron y lo que la evaluadora vio mientras la persona
-- dibujaba, que es dato de la administración y se pierde si no se escribe en el
-- momento. Por eso se carga en la hoja de la entrevista y la ficha lo muestra
-- sin poder cambiarlo: lo que se anotó con la persona enfrente no se corrige
-- semanas después de memoria.
--
-- Vacío se lee como "sin observaciones", que es el caso normal.

alter table evaluaciones
  add column if not exists bender_observaciones text,
  add column if not exists grafico_2_personas_observaciones text;

comment on column evaluaciones.bender_observaciones is
  'Lo que la evaluadora anotó del Bender durante la entrevista.';
comment on column evaluaciones.grafico_2_personas_observaciones is
  'Lo que la evaluadora anotó del gráfico durante la entrevista.';
