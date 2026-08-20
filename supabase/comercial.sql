-- Comercial: oportunidades y costos.
--
-- La cotización deja de ser una fila de un JSON del repositorio y pasa a ser
-- una oportunidad con estado, que es lo que hace falta para seguirla: un
-- archivo versionado se edita con un despliegue, y cambiar "enviada" por
-- "aprobada" no puede costar eso.
--
-- El documento que ve el cliente sigue siendo un HTML estático en
-- `public/q/<token>.html`. Lo que se mudó acá es el índice, no la propuesta.
--
-- Los cuatro estados son el embudo entero:
--   Lead     -> hay interés, todavía no se mandó nada.
--   Enviada  -> la propuesta está del lado del cliente.
--   Aprobada -> se cerró. Es lo que entra a la cuenta de resultado.
--   Perdida  -> no se cerró, por lo que sea.

create table if not exists public.cotizaciones (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete set null,
  -- El nombre escrito, para las oportunidades de clientes que todavía no son
  -- clientes. Cuando lo sean, se completa `empresa_id` y este queda de rótulo.
  cliente    text not null,
  concepto   text not null,
  importe    numeric(14,2) not null default 0,
  moneda     text not null default 'ARS',
  version    text not null default '1.0',
  estado     text not null default 'Lead'
             check (estado in ('Lead','Enviada','Aprobada','Perdida')),
  fecha      date not null default current_date,
  -- El enlace secreto del documento, cuando ya hay uno escrito.
  token      text unique,
  archivo    text,
  nota       text,
  -- Por qué se perdió. Es lo único que hace útil revisar las perdidas.
  motivo     text,
  created_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index if not exists cotizaciones_estado_idx on public.cotizaciones (estado);
create index if not exists cotizaciones_fecha_idx on public.cotizaciones (fecha desc);

alter table public.cotizaciones enable row level security;

drop trigger if exists cotizaciones_tocar on public.cotizaciones;
create trigger cotizaciones_tocar before update on public.cotizaciones
  for each row execute function public.tocar_actualizado();

-- ------------------------------------------------------------------ costos
-- Lo que cuesta entregar lo que se vendió.
--
-- Cuelga de la oportunidad aprobada y no de una contabilidad aparte: la
-- pregunta que contesta es "de esto que vendí, qué me quedó", y para eso el
-- costo tiene que estar al lado del ingreso que lo justifica.
create table if not exists public.costos (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  concepto      text not null,
  importe       numeric(14,2) not null default 0,
  tipo          text not null default 'Directo'
                check (tipo in ('Directo','Honorarios','Terceros','Otro')),
  fecha         date not null default current_date,
  nota          text,
  created_at    timestamptz not null default now()
);

create index if not exists costos_cotizacion_idx on public.costos (cotizacion_id);

alter table public.costos enable row level security;
