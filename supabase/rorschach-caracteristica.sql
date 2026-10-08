-- Lo que el candidato dijo en la encuesta sobre qué de la mancha le hizo ver
-- eso ("¿Qué característica de la mancha te hizo parecer que sea eso?").
--
-- Lo escribe la evaluadora en el capturador, después de marcar la locación y
-- la palabra, y es su ayuda para codificar los determinantes en la ficha: la
-- forma, el color, el sombreado o el movimiento salen de esta respuesta.
-- Va en su propia columna y no en la observación porque es un dato de la toma,
-- igual que la verbalización, y no una nota de quien codifica.

alter table rorschach_respuestas
  add column if not exists caracteristica text;

comment on column rorschach_respuestas.caracteristica is
  'Qué característica de la mancha le hizo ver eso, según dijo en la encuesta. Ayuda para codificar determinantes.';
