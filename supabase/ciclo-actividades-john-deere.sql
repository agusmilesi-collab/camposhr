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
--   4   La conversación, como sale           -> cd-conversacion
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
   'El último reconocimiento que le hiciste a alguien de tu equipo',
   'Con las palabras que usaste. No lo ve nadie más que vos, escribilo como salga.',
   '[]'::jsonb, null, 'Reconocimiento · escribir',
   -- Sin el aviso de siempre: esta consigna no se proyecta, así que decir que
   -- se proyecta sin el nombre hace pensar lo contrario. El enunciado ya dice
   -- que no lo ve nadie más que quien escribe.
   '{"aviso": ""}'::jsonb),

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
        {"clave": "que_hizo", "etiqueta": "¿Qué hizo exactamente?", "ayuda": "El detalle que se puede comprobar: “entregó el informe con una recomendación además de los números”."},
        {"clave": "cuando", "etiqueta": "¿Cuándo lo hizo?", "ayuda": "El día, o la semana, en que pasó."},
        {"clave": "para_que", "etiqueta": "¿Qué se consiguió gracias a eso?", "ayuda": "El valor que entregó con eso: una entrega que salió, un costo que bajó, una decisión que se pudo tomar."}
      ]
    }'::jsonb),

  -- 3 · La conversación pendiente, en un campo libre y sin ninguna ayuda. Lo
  -- que sale acá es el material del error, y el error es lo que la charla
  -- corrige. Con campos desde el principio escribirían bien de entrada y no
  -- habría nada que mostrar.
  ('cd-conversacion', 1, 3, 'texto',
   'La conversación difícil que tenés pendiente',
   'Escribí lo que le tenés que decir a alguien de tu equipo, con las palabras que usarías.',
   '[]'::jsonb, null, 'La conversación · como sale',
   -- Sin el aviso de siempre: lo que se escribe acá no se proyecta.
   '{"aviso": ""}'::jsonb),

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
      "prueba": "",
      "campos": [
        {"clave": "que_hizo", "etiqueta": "¿Qué hizo?", "ayuda": "Un hecho que la otra persona puede verificar: “entregó tres informes después de la fecha”. Un juicio como “es desprolijo” no se puede corregir."},
        {"clave": "que_dia", "etiqueta": "¿Qué día pasó?", "ayuda": "Una fecha, o un día de la semana."},
        {"clave": "cuantas_veces", "etiqueta": "¿Cuántas veces?", "ayuda": "Un número."},
        {"clave": "que_pedis", "etiqueta": "¿Qué le vas a pedir?", "ayuda": "Una acción concreta."},
        {"clave": "para_cuando", "etiqueta": "¿Para cuándo?", "ayuda": "Una fecha."}
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
  -- Sin título: la pregunta cambia según el tramo y es lo único que hay que
  -- leer, así que ocupa ella el lugar del título. Un rótulo arriba la repetía
  -- con otras palabras y dejaba la pregunta chica y en gris.
  ('cd-pregunta', 1, 9, 'texto',
   '',
   'Se proyecta sin tu nombre.',
   '[]'::jsonb, null, 'Preguntas · escribir',
   -- El aviso del pie hace tres cosas: abre el alcance, porque por el tema del
   -- día suponen que la pregunta tiene que ser sobre conversaciones difíciles;
   -- ancla la búsqueda en algo que les pasó, que es lo que la vuelve fácil de
   -- escribir; y pide la forma de pregunta, porque lo que se escriba acá lo
   -- contesta alguien en voz alta y un tema suelto no se puede contestar.
   '{
      "avisos": {
        "Menos de un año": "Sobre cualquier cosa de liderar un equipo. Pensá en algo que te pasó estas semanas y no supiste resolver. Se proyecta sin tu nombre.",
        "Más de un año": "Sobre cualquier cosa de liderar un equipo. Escribí algo que te costó aprender y hoy le ahorrarías a alguien que empieza. Se proyecta sin tu nombre."
      },
      "segun": "rol",
      "enunciados": {
        "Menos de un año": "Escribí una pregunta: ¿qué te gustaría que alguien con más años liderando te explicara ahora?",
        "Más de un año": "¿Qué te hubiese gustado saber en tu primer año como líder, y lo terminaste aprendiendo con el tiempo?"
      }
    }'::jsonb),

  -- 10 · El reparto. Diez Deer Coins entre las preguntas de los que recién
  -- empiezan, y nadie puede ponerle a la suya: sin esa regla, uno pone sus
  -- diez en la propia y cobra el pozo con ganancia esperada siempre positiva.
  ('cd-monedas', 1, 10, 'monedas',
   'Repartí tus 10 Deer Coins',
   'Entre las preguntas que más querés escuchar. Podés poner todas en una.',
   '[]'::jsonb, null, 'Preguntas · repartir Deer Coins',
   '{
      "desde": "cd-pregunta",
      "desde_titulo": "Tu pregunta",
      "monedas": 10,
      "de_quienes": {"campo": "rol", "valor": "Menos de un año"}
    }'::jsonb),

  -- 12 a 14 · La encuesta del final. Las tres van en el mismo grupo: se abren
  -- de una vez y cada uno las recorre en fila mientras la sala se levanta.
  -- El número va primero porque es el que se contesta aunque después no
  -- escriban nada.
  ('cd-nps', 1, 12, 'escala',
   '¿Qué tan probable es que le recomiendes este encuentro a otro líder de John Deere?',
   'De 1 a 10, donde 10 es que se lo recomendarías seguro.',
   '[]'::jsonb, 'cierre', 'Encuesta final · las 3 preguntas',
   '{"aviso": ""}'::jsonb),

  -- La primera abierta mide lo único que importa del día siguiente: si quedó
  -- algo que se pueda hacer. Y da las frases textuales del informe.
  ('cd-llevas', 1, 13, 'texto',
   '¿Qué te llevás concreto, o qué te resonó que podés aplicar?',
   'Una sola cosa alcanza.',
   '[]'::jsonb, 'cierre', 'Encuesta · qué te llevás',
   '{"aviso": "Se lee para el informe, sin tu nombre."}'::jsonb),

  -- La última: qué temas de liderazgo quiere aprender, tres de cinco y en
  -- orden. Las cinco opciones no se pisan (a sí mismo, a cada persona, al
  -- equipo, los resultados, el cambio), y elegir tres obliga a dejar dos
  -- afuera. La clave queda igual: es la última del encuentro y el teléfono la
  -- usa para dar el resumen.
  ('cd-cambiarias', 1, 14, 'prioridad',
   '¿Qué temas de liderazgo te gustaría aprender?',
   'Elegí 3, en orden: la primera que toques es la que más te interesa.',
   '["Liderarme a mí · Tiempo, prioridades, manejo del estrés y de las propias emociones", "Liderar a cada persona · Conversaciones, reconocimiento, desarrollo, motivación", "Liderar al equipo · Delegar, reuniones, conflictos entre compañeros, confianza", "Liderar para resultados · Objetivos, decisiones, seguimiento, GPM", "Liderar el cambio · Comunicar decisiones de la compañía, influir hacia arriba y entre áreas"]'::jsonb,
   'cierre', 'Encuesta · temas para aprender',
   '{"aviso": "Se lee para el informe, sin tu nombre.", "elegir": 3}'::jsonb)

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
         ('cd-reconocimiento', 4),
         ('cd-reconocimiento-traducido', 8),
         ('cd-conversacion', 9),
         ('cd-traduccion', 19),
         ('cd-ensayo-1', 22),
         ('cd-ensayo-2', 23),
         ('cd-ensayo-3', 24),
         ('cd-pregunta', 26),
         ('cd-monedas', 27),
         ('cd-reparto', 30),
         ('cd-nps', 32),
         ('cd-llevas', 32),
         ('cd-cambiarias', 32)
       ) as v(clave, placa)
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = v.clave;
