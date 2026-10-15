-- Los turnos del inquilino: a quién atiende en cada hora que tiene reservada.
--
-- Es la agenda de su consulta, adentro de las horas que alquila en el Centro.
-- Una fila por hora de reloj: la reserva de 9 a 12 son tres turnos posibles.
-- Lo escribe solo el inquilino desde su zona, y lo lee solo él: el equipo del
-- Centro no ve a quién atiende nadie. Por eso no tiene vínculo con `reservas`
-- más que la fecha y la hora: si la reserva se suelta, el turno queda huérfano
-- y la pantalla no lo muestra, pero el dato de la persona no se borra solo.
create table if not exists public.centro_turnos (
  id            uuid primary key default gen_random_uuid(),
  inquilino_id  uuid not null references public.inquilinos (id) on delete cascade,
  fecha         date not null,
  desde_hora    time not null,
  paciente      text not null check (length(trim(paciente)) > 0),
  nota          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (inquilino_id, fecha, desde_hora)
);
create index if not exists centro_turnos_inquilino_fecha_idx on public.centro_turnos (inquilino_id, fecha);
alter table public.centro_turnos enable row level security;
