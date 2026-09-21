-- Dos tipos de actividad nuevos, y la configuración de cada una.
--
-- `campos`  · varios campos en una pantalla, uno por dato. Es lo que convierte
--             una frase escrita de corrido en un hecho verificable: separar
--             "qué hizo", "qué día" y "cuántas veces" hace imposible escribir
--             un adjetivo sin darse cuenta. Puede mostrar arriba lo que la
--             persona escribió en otra actividad, para que traduzca lo suyo en
--             lugar de escribir algo nuevo.
--
-- `reparto` · no se responde: el servidor le asigna a cada persona con años en
--             el rol una de las preguntas que quedaron sin contestar, de otra
--             área que la suya.
--
-- `monedas` · repartir una cantidad fija entre las respuestas de texto de otra
--             actividad. Sale en una sola escritura cuando confirma, que es lo
--             que la prueba de carga permite: una ráfaga de pujas repetidas
--             está arriba del techo medido.
--
-- `config` guarda lo que cada tipo necesita y que no entra en `opciones`: la
-- lista de campos, de qué actividad viene el texto, cuántas monedas se
-- reparten, y el enunciado que cambia según lo que la persona contestó en el
-- registro.

begin;

alter table public.actividades drop constraint if exists actividades_tipo_check;
alter table public.actividades add constraint actividades_tipo_check
  check (tipo in (
    'palabra','opcion','escala','texto','marcas','enlace','cuestionario',
    'cruce','plan','ensayo','frases','campos','monedas','reparto'
  ));

alter table public.actividades
  add column if not exists config jsonb not null default '{}'::jsonb;

commit;
