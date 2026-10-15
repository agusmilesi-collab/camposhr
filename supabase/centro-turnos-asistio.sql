-- 15/10/2026. Si el paciente vino o no: se marca desde la tarjeta del turno
-- en Inicio. Null es "todavía no se marcó".
alter table public.centro_turnos add column if not exists asistio boolean;
