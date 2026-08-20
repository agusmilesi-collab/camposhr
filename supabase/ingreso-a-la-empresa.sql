-- Si la persona entró a trabajar en la empresa que la evaluó.
--
-- Es el final del recorrido y lo único que dice si la evaluación sirvió: se
-- recomendó a alguien y la empresa lo tomó, o no. Hoy eso se sabe preguntando,
-- y se pierde.
--
-- Va en `evaluaciones` y no en `personas` porque la misma persona puede
-- presentarse a dos búsquedas y entrar en una sola.
--
-- `ingreso` en null es "todavía no se sabe", que es el estado normal hasta que
-- la empresa contesta. Por eso es nullable y no un booleano con default: un
-- `false` se lee como "no entró" y no es lo mismo que no tener la respuesta.
--
-- OJO con los nombres: `fecha_ingreso` ya existe y es cuándo entró la
-- evaluación al sistema. La fecha de esta columna es cuándo empezó a trabajar.

alter table public.evaluaciones
  add column if not exists ingreso boolean,
  add column if not exists fecha_ingreso_empresa date;

comment on column public.evaluaciones.ingreso is
  'Si la persona entró a trabajar en la empresa. Null = todavía no se sabe.';
comment on column public.evaluaciones.fecha_ingreso_empresa is
  'Cuándo empezó a trabajar. No confundir con fecha_ingreso, que es cuándo entró la evaluación.';
