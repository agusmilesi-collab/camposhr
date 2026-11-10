-- La apertura del mes del Centro y los cambios que pide el inquilino al renovar.
--
-- Hasta el 10/11/2026 el mes se abría con un script corrido desde una
-- computadora: noviembre no se abrió y el calendario quedó vacío diez días.
-- Ahora lo abre el sistema (`lib/apertura-mes.ts`), solo o con el botón de la
-- pestaña "Mes que viene".

-- Qué meses ya se abrieron. Abrir de nuevo no duplica nada (salta lo que ya
-- está reservado), pero con la fila el cron sabe que no tiene que intentarlo.
create table if not exists public.centro_meses (
  periodo    date primary key,
  abierto_at timestamptz not null default now(),
  quien      text,
  reservas   integer not null default 0,
  importe    numeric not null default 0
);

alter table public.centro_meses enable row level security;

-- Los meses que se cargaron a mano antes de esto.
insert into public.centro_meses (periodo, quien) values
  ('2026-09-01', 'Carga a mano'), ('2026-10-01', 'Carga a mano'), ('2026-11-01', 'Carga a mano')
on conflict (periodo) do nothing;

-- Las horas que el inquilino deja al renovar, marcadas sobre sus bandas:
-- [{ "contrato": "<id>", "hora": 18 }] es "dejo la hora de 18 a 19 de esa
-- banda". Reemplaza al texto libre para lo que se deja; lo que quiere sumar
-- sigue en `nota`, porque depende de qué esté libre y lo arma el equipo.
alter table public.renovaciones add column if not exists deja jsonb not null default '[]';

-- Cuándo la apertura ya aplicó esta respuesta a los contratos (cerró las
-- bandas de quien no sigue, recortó las que dejan horas). Sin la marca, abrir
-- dos veces recortaría dos veces.
alter table public.renovaciones add column if not exists aplicada_at timestamptz;
