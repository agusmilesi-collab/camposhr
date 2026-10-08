-- Qué contestó cada inquilino cuando se le preguntó si renueva sus horas.
--
-- La pregunta aparece en su inicio desde el 25 de cada mes, sobre el mes que
-- sigue. Una fila por persona y por mes: contestar de nuevo corrige la
-- respuesta, no suma otra.
--
--   si        sigue con las mismas bandas
--   no        no sigue el mes que viene
--   cambiar   sigue, con otras horas; qué quiere cambiar va en `nota`
--
-- **La respuesta no toca los contratos.** Es un aviso para el equipo, que es
-- quien cierra o cambia las bandas. `visto_at` dice que alguien del equipo ya
-- la atendió: mientras esté en null, un "no" o un "cambiar" salen como aviso en
-- la columna Hoy de Inicio.

create table if not exists public.renovaciones (
  id            uuid primary key default gen_random_uuid(),
  inquilino_id  uuid not null references public.inquilinos (id) on delete cascade,
  periodo       date not null,
  respuesta     text not null check (respuesta in ('si', 'no', 'cambiar')),
  nota          text,
  respondido_at timestamptz not null default now(),
  visto_at      timestamptz,
  unique (inquilino_id, periodo)
);

alter table public.renovaciones enable row level security;

-- Los feriados del mes que renueva en los que igual quiere usar su sala.
--
-- El Centro cierra los feriados, así que por defecto esas fechas no se
-- reservan. Quien quiere trabajar ese día lo tilda al renovar, y esas horas se
-- le suman al mes. Vacío es lo normal: no usa ninguno.
alter table public.renovaciones add column if not exists feriados date[] not null default '{}';
