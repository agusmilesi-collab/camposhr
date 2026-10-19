-- El seguimiento a los noventa días, preguntado por correo a quien pidió la búsqueda.
--
-- A los noventa días del ingreso sale un correo con un enlace a
-- camposhr.com/seguimiento/<token>, con tres preguntas cerradas y una abierta.
-- Las respuestas quedan acá; `seguimiento_resultado` (Bien, Regular, Mal) se
-- deduce de ellas para que Entregados y el data hub sigan leyendo lo mismo, y
-- el comentario va a `seguimiento_notas`.
alter table public.evaluaciones
  -- El enlace del correo. Se crea al mandar el primero y no cambia.
  add column if not exists seguimiento_token text unique,
  -- Cuándo salió el correo. Sin esto, el aviso diario lo vuelve a intentar.
  add column if not exists seguimiento_enviado_el timestamptz,
  -- Cuándo se intentó y no había a quién mandarlo: sin quien pidió y sin un
  -- contacto que reciba lo de todos. Se vuelve a intentar cada día.
  add column if not exists seguimiento_sin_destino_el timestamptz,
  -- Las tres respuestas, con el texto de la opción elegida.
  add column if not exists seguimiento_sigue text,
  add column if not exists seguimiento_desempeno text,
  add column if not exists seguimiento_recontrataria text,
  add column if not exists seguimiento_respondido_el timestamptz,
  -- A quién le escribimos, para saber quién contestó.
  add column if not exists seguimiento_respondio text;

notify pgrst, 'reload schema';

-- El recordatorio, una sola vez, a los siete días del primer correo si nadie
-- contestó (Agustín, 19/10/2026). Mismo enlace, mismos destinatarios.
alter table public.evaluaciones
  add column if not exists seguimiento_recordado_el timestamptz;

notify pgrst, 'reload schema';
