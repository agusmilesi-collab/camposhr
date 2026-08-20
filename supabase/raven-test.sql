-- El test de Raven, tomado desde el OS.
--
-- Una sesión por candidato: su enlace, cuándo empezó, cuándo terminó y lo que
-- fue respondiendo. Las respuestas se guardan a medida que se contestan y no
-- al final, porque cuarenta y cinco minutos de trabajo no pueden depender de
-- que el navegador siga vivo al cerrar.
--
-- El puntaje no vive acá: cuando la sesión termina se corrige y el resultado
-- va a `raven`, que es de donde lo lee la ficha. Así la corrección queda
-- separada de lo que la persona respondió.

create table if not exists public.raven_sesiones (
  id             uuid primary key default gen_random_uuid(),
  evaluacion_id  uuid not null references public.evaluaciones (id) on delete cascade,
  -- El enlace que se le manda. Secreto y de un solo uso.
  token          text not null unique,
  creado_at      timestamptz not null default now(),
  -- Cuándo abrió la primera lámina: de acá cuentan los cuarenta y cinco
  -- minutos, y por eso lo fija el servidor y no el navegador.
  iniciado_at    timestamptz,
  terminado_at   timestamptz,
  -- Por qué terminó: la cerró la persona o se acabó el tiempo.
  cierre         text check (cierre in ('entregado', 'tiempo')),
  -- Lo elegido en cada lámina: {"1": 4, "2": 7, ...}. Sin corregir.
  respuestas     jsonb not null default '{}'
);

create index if not exists raven_sesiones_evaluacion_idx
  on public.raven_sesiones (evaluacion_id);

alter table public.raven_sesiones enable row level security;
