-- Cuándo se le mandaron al candidato las indicaciones del Benziger.
--
-- A quien lleva Benziger le llega, tres minutos después del correo con el día
-- y la hora de su entrevista, otro con asunto "Indicaciones BZG": que va a
-- recibir un cuestionario de la plataforma de Benziger y cómo contestarlo.
-- Sale una sola vez por evaluación; esta columna es la que lo recuerda.
alter table public.evaluaciones add column if not exists aviso_bzg_el timestamptz;
