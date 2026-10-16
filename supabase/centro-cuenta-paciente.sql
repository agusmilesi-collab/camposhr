-- 16/10/2026. La cuenta corriente del paciente, adentro de su ficha: el
-- costo de la consulta se configura por paciente, y cada turno dice si ese
-- día se pagó. `cobrado` congela el importe del día en que se marcó pagado,
-- así subir el precio después no reescribe lo ya cobrado.
alter table public.centro_pacientes add column if not exists precio_consulta numeric(12,2);
alter table public.centro_turnos add column if not exists pagado boolean not null default false;
alter table public.centro_turnos add column if not exists cobrado numeric(12,2);
