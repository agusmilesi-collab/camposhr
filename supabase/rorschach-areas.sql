-- Las áreas que marcó la evaluadora en la lámina para cada respuesta.
--
-- La ficha guarda la localización con un solo número (n_localizacion), y una
-- respuesta que junta áreas de distinta clase queda como Dd99, que es como la
-- escribe Exner. Pero el puntaje Z sale de qué áreas se integraron y de si se
-- tocan (ZA) o no (ZD): con Dd99 sola no se puede volver a calcular, y corregir
-- después cualquier celda de esa fila recalculaba el Z con un área única y lo
-- borraba. Se guardan las áreas tal cual se marcaron ("D2", "Dd25").
--
-- Nula en las filas cargadas antes: para esas se sigue rearmando el área desde
-- n_localizacion, como hasta ahora.

alter table rorschach_respuestas
  add column if not exists areas text[];

comment on column rorschach_respuestas.areas is
  'Áreas marcadas en la lámina para esta respuesta (D2, Dd25...). De acá sale el Z cuando la localización queda como Dd99.';
