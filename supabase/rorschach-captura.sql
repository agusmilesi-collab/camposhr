-- La codificación capturada durante la entrevista.
--
-- Dos columnas nuevas en `rorschach_respuestas`, las dos para lo mismo: que en
-- la ficha se sepa qué llegó de la pantalla de codificación y qué escribió la
-- evaluadora.
--
-- `observacion` es el campo de texto libre por respuesta. No guarda la
-- verbalización completa de la persona a propósito: eso es dato de salud y el
-- protocolo escrito sigue siendo la fuente. Guarda lo que la evaluadora quiera
-- dejar anotado de esa respuesta, que es lo que después le permite completar
-- los determinantes, los contenidos, AgC y SL, que son los cinco campos que la
-- herramienta no puede saber.
--
-- `origen` dice de dónde vino la fila. Sin esto, una fila con la mitad de los
-- campos vacíos no se distingue de una que se empezó a cargar a mano y quedó
-- por la mitad, y esa diferencia es la que hace que no se olvide ninguno.
--
--   'captura'  la trajo la pantalla de la entrevista, faltan campos a mano
--   'manual'   se cargó entera en la ficha, como siempre
--
-- El valor por omisión es 'manual' porque es lo que había hasta ahora: las
-- filas que ya existen se cargaron a mano.

alter table public.rorschach_respuestas
  add column if not exists observacion text,
  add column if not exists origen text not null default 'manual';

alter table public.rorschach_respuestas
  drop constraint if exists rorschach_origen_valido;

alter table public.rorschach_respuestas
  add constraint rorschach_origen_valido check (origen in ('captura', 'manual'));

comment on column public.rorschach_respuestas.observacion is
  'Nota libre de la evaluadora sobre esta respuesta. No es la verbalización.';
comment on column public.rorschach_respuestas.origen is
  'captura = vino de la pantalla de la entrevista; manual = se cargó en la ficha.';
