-- Las actividades de "Conversaciones difíciles", la charla de John Deere del
-- 24 de septiembre de 2026.
--
-- Una sola charla, así que `charla` es 1 en todas y el orden es el del reloj.
-- Cuelgan del ciclo y no de la empresa: el material es el mismo si mañana se
-- dicta en otro lado, y lo que cambia es la corrida.
--
-- Se puede correr más de una vez: la clave única no duplica nada, y el update
-- del final deja las filas como dice este archivo aunque ya existieran.
--
-- El reloj de referencia, 105 minutos:
--   8   El reconocimiento traducido          -> cd-reconocimiento, cd-reconocimiento-traducido
--   4   La conversación, como sale           -> cd-conversacion, cd-es-hecho
--   9   Teoría: hecho contra interpretación     (sin teléfono)
--   20  La conversación, traducida           -> cd-traduccion
--   9   Teoría: los cinco momentos              (sin teléfono)
--   32  Role play, tres rondas               -> cd-ensayo-1, cd-ensayo-2, cd-ensayo-3
--   18  Las preguntas y el reparto           -> cd-pregunta, cd-monedas
--   5   El repaso y la descarga                 (sin teléfono)

insert into public.actividades
  (ciclo_id, clave, charla, orden, tipo, titulo, enunciado, opciones, grupo, titulo_control, config)
select
  c.id, v.clave, v.charla, v.orden, v.tipo, v.titulo, v.enunciado,
  v.opciones, v.grupo, v.titulo_control, v.config
from public.ciclos c
cross join (values

  -- 1 · El reconocimiento, como salió. Se abre con la sala recién sentada: el
  -- ejercicio optimista primero, y por lo que salió bien.
  ('cd-reconocimiento', 1, 1, 'texto',
   'El último reconocimiento que diste',
   'A alguien de tu equipo, con las palabras que usaste. Nadie lo ve más que vos.',
   '[]'::jsonb, null, 'Reconocimiento · escribir',
   '{}'::jsonb),

  -- 2 · El mismo reconocimiento, en tres campos. Después de escuchar la
  -- diferencia entre "sos un crack" y el dato.
  -- El primer campo pide el detalle comprobable y no el verbo pelado. Con
  -- "un verbo y un objeto" la traducción salía "redactó el informe", que no le
  -- dice a nadie qué repetir: redactar informes es lo que esa persona hace
  -- todos los meses. Lo que se saca es la calificación ("lo hizo bien"), no
  -- aquello que distinguió a ese trabajo, que es justamente lo repetible.
  ('cd-reconocimiento-traducido', 1, 2, 'campos',
   'Ahora traducilo',
   'Lo mismo que escribiste, **con el detalle suficiente para que pueda volver a hacerlo**.',
   '[]'::jsonb, null, 'Reconocimiento · traducir',
   '{
      "desde": "cd-reconocimiento",
      "desde_titulo": "Lo que escribiste recién",
      "campos": [
        {"clave": "que_hizo", "etiqueta": "¿Qué hizo exactamente?", "ayuda": "El detalle que se puede comprobar: “entregó el informe con las tres áreas cargadas”. “Lo hizo bien” no dice qué repetir."},
        {"clave": "cuando", "etiqueta": "¿Cuándo lo hizo?", "ayuda": "El día, o la semana, en que pasó."},
        {"clave": "para_que", "etiqueta": "¿Qué se consiguió gracias a eso?", "ayuda": "El efecto. Acá sí entra por qué estuvo bueno."}
      ]
    }'::jsonb),

  -- 3 · La conversación pendiente, en un campo libre y sin ninguna ayuda. Lo
  -- que sale acá es el material del error, y el error es lo que la charla
  -- corrige. Con campos desde el principio escribirían bien de entrada y no
  -- habría nada que mostrar.
  ('cd-conversacion', 1, 3, 'texto',
   'La conversación que tenés pendiente',
   'Escribila como se la dirías. No pedimos con quién: ningún nombre entra acá.',
   '[]'::jsonb, 'conversacion', 'La conversación · como sale',
   '{}'::jsonb),

  -- 4 · La apuesta, antes de la teoría. Es el "antes" de la única medición que
  -- se proyecta, y funciona porque se contesta cuando todavía cree que sí.
  ('cd-es-hecho', 1, 4, 'opcion',
   '¿Lo que escribiste es un hecho?',
   'Un hecho es algo que la otra persona puede ir a verificar.',
   '["Sí, es un hecho", "No, es una interpretación mía"]'::jsonb,
   'conversacion', 'La conversación · la apuesta',
   '{}'::jsonb),

  -- 5 · La traducción, con su propia frase arriba. Los campos son el control:
  -- el que completó "qué día" y "cuántas veces" no tiene forma de haber
  -- escrito un adjetivo, y por eso no hay cuestionario al final.
  ('cd-traduccion', 1, 5, 'campos',
   'Traducí tu conversación',
   'No escribas otra: **rompé la que ya tenés**.',
   '[]'::jsonb, null, 'La conversación · traducir',
   -- Acá sí se nombran el hecho y el juicio: esta consigna va después de la
   -- teoría, y en la del reconocimiento, que va quince minutos antes, esas dos
   -- palabras todavía no significan nada para la sala.
   '{
      "desde": "cd-conversacion",
      "desde_titulo": "Lo que escribiste antes de la teoría",
      "campos": [
        {"clave": "que_hizo", "etiqueta": "¿Qué hizo?", "ayuda": "Un hecho que la otra persona puede verificar: “entregó tres informes después de la fecha”. Un juicio como “es desprolijo” no se puede corregir."},
        {"clave": "que_dia", "etiqueta": "¿Qué día pasó?", "ayuda": "Una fecha, o un día de la semana."},
        {"clave": "cuantas_veces", "etiqueta": "¿Cuántas veces?", "ayuda": "Un número."},
        {"clave": "que_pedis", "etiqueta": "¿Qué le vas a pedir?", "ayuda": "Una acción concreta."},
        {"clave": "para_cuando", "etiqueta": "¿Para cuándo?", "ayuda": "Una fecha."},
        {"clave": "cuando_se_lo_decis", "etiqueta": "¿Qué día se lo decís?", "ayuda": "Antes del jueves 2 de octubre."}
      ]
    }'::jsonb),

  -- 6, 7 y 8 · Las tres rondas del role play. Van sueltas y nunca del mismo
  -- grupo: si viajaran juntas, el teléfono tendría desde la primera las
  -- reacciones de las tres, y la sorpresa es lo que hace que el ensayo sirva.
  ('cd-ensayo-1', 1, 6, 'ensayo', 'Primera ronda', null, '[]'::jsonb, null,
   'Role play · ronda 1', '{"ronda": 1}'::jsonb),
  ('cd-ensayo-2', 1, 7, 'ensayo', 'Segunda ronda', null, '[]'::jsonb, null,
   'Role play · ronda 2', '{"ronda": 2}'::jsonb),
  ('cd-ensayo-3', 1, 8, 'ensayo', 'Tercera ronda', null, '[]'::jsonb, null,
   'Role play · ronda 3', '{"ronda": 3}'::jsonb),

  -- 9 · La pregunta del bloque final. El enunciado cambia según lo que la
  -- persona contestó en el registro: es la misma pregunta mirada desde los dos
  -- lados, y por eso la lista que producen se lee junta.
  ('cd-pregunta', 1, 9, 'texto',
   'Una pregunta para la sala',
   'Se proyecta sin tu nombre.',
   '[]'::jsonb, null, 'Preguntas · escribir',
   '{
      "segun": "rol",
      "enunciados": {
        "Menos de un año": "¿Qué te gustaría que alguien con más años liderando te explicara ahora?",
        "Más de un año": "¿Qué te hubiese gustado saber en tu primer año como líder, y lo terminaste aprendiendo con el tiempo?"
      }
    }'::jsonb),

  -- 10 · El reparto. Diez monedas entre las preguntas de los que recién
  -- empiezan, y nadie puede ponerle a la suya: sin esa regla, uno pone sus
  -- diez en la propia y cobra el pozo con ganancia esperada siempre positiva.
  ('cd-monedas', 1, 10, 'monedas',
   'Repartí tus diez monedas',
   'Entre las preguntas que más querés escuchar. Podés poner todas en una.',
   '[]'::jsonb, null, 'Preguntas · repartir monedas',
   '{
      "desde": "cd-pregunta",
      "monedas": 10,
      "de_quienes": {"campo": "rol", "valor": "Menos de un año"}
    }'::jsonb)

) as v(clave, charla, orden, tipo, titulo, enunciado, opciones, grupo, titulo_control, config)
where c.nombre = 'Conversaciones difíciles'
on conflict (ciclo_id, clave) do update
  set charla = excluded.charla,
      orden = excluded.orden,
      tipo = excluded.tipo,
      titulo = excluded.titulo,
      enunciado = excluded.enunciado,
      opciones = excluded.opciones,
      grupo = excluded.grupo,
      titulo_control = excluded.titulo_control,
      config = excluded.config;
-- En qué placa del deck se abre cada una. Es lo que el panel muestra al lado
-- del título: mientras dicta, lo que la expositora tiene delante es el deck, y
-- el número le dice si está parada donde corresponde.
update public.actividades a
   set placa = v.placa
  from public.ciclos c,
       (values
         ('cd-reconocimiento', 5),
         ('cd-reconocimiento-traducido', 8),
         ('cd-conversacion', 9),
         ('cd-es-hecho', 10),
         ('cd-traduccion', 18),
         ('cd-ensayo-1', 23),
         ('cd-ensayo-2', 24),
         ('cd-ensayo-3', 25),
         ('cd-pregunta', 27),
         ('cd-monedas', 29),
         ('cd-reparto', 30)
       ) as v(clave, placa)
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = v.clave;
