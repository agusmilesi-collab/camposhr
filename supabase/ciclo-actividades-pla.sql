-- Actividades del ciclo de Pla S.A.
-- Ejecutar en el SQL Editor después de ciclo.sql.
--
-- Cada fila sale de una placa del guion, citada en el comentario de arriba. No
-- hay ninguna actividad que el guion no pida ya en papel: lo único que cambia
-- es dónde se responde.
--
-- Se puede correr más de una vez: la clave única (empresa_id, clave) hace que
-- la segunda pasada no duplique nada.
--
-- Cargar una actividad no la pone en juego. La expositora abre la que quiere
-- desde su pantalla de control, y el criterio del plan es una por charla.

insert into public.actividades
  (empresa_id, clave, charla, orden, tipo, titulo, enunciado, opciones)
select
  e.id, v.clave, v.charla, v.orden, v.tipo, v.titulo, v.enunciado, v.opciones
from public.empresas e
cross join (values

  -- Charla 1 · PLACA 14: "Escribí en una línea el momento exacto de mañana:
  -- cuándo, dónde y antes de qué."
  ('c1-momento', 1, 1, 'texto',
   'El momento exacto de mañana',
   'En una línea: cuándo, dónde y antes de qué.',
   '[]'::jsonb),

  -- Charla 4 · PLACA 2 y 3: "Solo de pensarlo, ¿qué sentís? No lo que vas a
  -- decir, lo que sentís."
  ('c4-que-siento', 4, 1, 'palabra',
   'Solo de pensarlo, ¿qué sentís?',
   'Una palabra. No lo que vas a decir: lo que sentís.',
   '[]'::jsonb),

  -- Charla 4 · PLACA 4: "A un líder lo traba lo que la situación le genera."
  ('c4-cuanto-cuesta', 4, 2, 'escala',
   '¿Cuánto te cuesta dar una mala noticia?',
   'Del 1 al 10, donde 10 es lo que más te cuesta.',
   '[]'::jsonb),

  -- Charla 4 · PLACA 8: los cuatro pasos, proyectados durante todo el ensayo.
  -- La marca el observador AL TERMINAR la ronda, de memoria: marcar durante el
  -- ensayo lo sacaría de observar justo cuando su trabajo es mirar.
  ('c4-observador', 4, 3, 'marcas',
   '¿Qué pasos aparecieron en el ensayo?',
   'Marcá los que viste. De memoria, ahora que terminó la ronda.',
   '["Encuadró", "Lo dijo claro", "Dio lugar en silencio", "Cerró con un paso"]'::jsonb),

  -- Charla 5 · PLACA 5: el juego Match, las nueve frases para completar.
  -- Cada una es su propia nube: el "nadie puso lo mismo" pasa a estar a la
  -- vista en lugar de ser una afirmación de la expositora.
  ('c5-match-1', 5, 1, 'palabra', 'Jugo de…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-2', 5, 2, 'palabra', 'Prohibido…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-3', 5, 3, 'palabra', 'Recursos…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-4', 5, 4, 'palabra', 'Planta…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-5', 5, 5, 'palabra', 'Hoja de…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-6', 5, 6, 'palabra', 'En un bar siempre pido…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-7', 5, 7, 'palabra', 'Grano de…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-8', 5, 8, 'palabra', 'Venta de…', 'Lo primero que se te ocurra.', '[]'::jsonb),
  ('c5-match-9', 5, 9, 'palabra', 'Sentir…', 'Lo primero que se te ocurra.', '[]'::jsonb),

  -- Charla 5 · PLACA 2: "Pensá una tensión de tu equipo de la que nadie habla."
  -- Es el banco anónimo con el que después se ensaya sobre casos reales del
  -- propio grupo, sin exponer a quien los escribió.
  ('c5-tension', 5, 10, 'texto',
   'La tensión de la que nadie habla',
   'Esa incomodidad que todos notan y nadie nombra. Se proyecta sin tu nombre.',
   '[]'::jsonb),

  -- Charla 5 · PLACA 13: "'Llegó tarde' es un hecho. 'No le importa nada' es
  -- una interpretación."
  ('c5-hecho', 5, 11, 'opcion',
   '"No le importa nada", ¿qué es?',
   NULL,
   '["Un hecho", "Una interpretación"]'::jsonb),

  -- Charla 5 · PLACA 18: las tres etapas del conflicto.
  ('c5-etapa', 5, 12, 'opcion',
   '¿En qué etapa está tu conflicto?',
   'El que pensaste al principio de la charla.',
   '["Etapa 1 · todavía se puede hablar", "Etapa 2 · yo tengo razón y vos no", "Etapa 3 · importa que el otro pierda"]'::jsonb),

  -- Charla 5 · el compromiso con el que se cierra el ciclo.
  ('c5-compromiso', 5, 13, 'texto',
   '¿Con qué te comprometés?',
   'Algo concreto, que dependa solo de vos.',
   '[]'::jsonb)

) as v(clave, charla, orden, tipo, titulo, enunciado, opciones)
where e.slug = 'pla-sa'
on conflict (empresa_id, clave) do nothing;


-- ---------------------------------------------------------------------------
-- Sin cargar, porque la forma de responderlas todavía no está decidida:
--
--   Charla 1 · los dos tiempos del ejercicio de multitarea. Son dos números en
--   segundos y ninguno de los cinco tipos los toma: 'escala' va del 1 al 10.
--
--   Charla 2 · las palabras de la rueda que uso poco o nunca (PLACA 9). El
--   guion pide marcar 2 o 3 sobre la rueda entera; 'marcas' necesita la lista
--   de opciones y la rueda tiene demasiadas para el teléfono.
--
--   Charla 2 · la tabla de cuatro columnas, y el chequeo de treinta segundos.
--   Son varias respuestas encadenadas, no una.
--
--   Charla 3 · a quién le voy a consultar una decisión.
--
--   Charla 5 · transformar de objetivo a subjetivo (PLACA 16).
--
-- Las cinco entran como 'texto' si se decide que van, pero conviene definirlas
-- desde el informe: primero qué le vamos a entregar a Recursos Humanos y
-- después qué actividad hace falta.
