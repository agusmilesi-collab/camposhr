-- El precio de cada batería, con su historia.
--
-- ## Por qué una tabla y no una columna
--
-- Un precio que se pisa borra el pasado: la evaluación de marzo pasa a valer lo
-- que vale hoy, y lo facturado deja de coincidir con lo registrado. Acá cada
-- actualización es una fila nueva y el precio de una evaluación es el que regía
-- el día que entró (`evaluaciones.fecha_ingreso`), no el de hoy.
--
-- Esa es la regla completa: las actualizaciones valen para adelante. Una
-- evaluación cargada hoy con fecha de marzo toma el precio de marzo, porque lo
-- que manda es la fecha del pedido y no cuándo se cargó.
--
-- `desde` es la fecha en que empieza a regir, y por eso puede ser futura: se
-- puede dejar cargado un aumento que arranca el mes que viene.
--
-- Queda quién lo cambió porque es una decisión comercial y en la reunión
-- siguiente alguien va a preguntar de dónde salió ese número.

create table if not exists public.bateria_precios (
  id         uuid primary key default gen_random_uuid(),
  bateria_id uuid not null references public.baterias (id) on delete cascade,
  precio     numeric(12, 2) not null check (precio >= 0),
  desde      date not null,
  quien      text,
  created_at timestamptz not null default now(),

  -- Dos precios distintos para el mismo día son un empate sin criterio.
  unique (bateria_id, desde)
);

create index if not exists bateria_precios_vigencia_idx
  on public.bateria_precios (bateria_id, desde desc);

alter table public.bateria_precios enable row level security;

-- El precio que ya estaba pasa a ser la primera fila de la historia, vigente
-- desde antes de cualquier evaluación cargada: sin esto, las evaluaciones
-- viejas se quedarían sin precio.
insert into public.bateria_precios (bateria_id, precio, desde, quien)
select id, precio, date '2020-01-01', 'migración'
from public.baterias
where precio is not null
on conflict (bateria_id, desde) do nothing;

comment on table public.bateria_precios is
  'Historia de precios. El precio de una evaluación es el vigente a su fecha de pedido.';
comment on column public.bateria_precios.desde is
  'Desde cuándo rige. Puede ser futura: un aumento que arranca el mes que viene.';
