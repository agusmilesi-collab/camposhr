-- Precios acordados con un cliente, con vigencia.
--
-- ## Por qué existe
--
-- Hay clientes que licitan: Lorena presentó precios en una licitación de Cofco
-- y esos precios se respetan durante el plazo que fija la licitación, aunque
-- la lista general suba en el medio. Hasta hoy el OS tenía un solo precio por
-- batería (`bateria_precios`), y a Cofco había que corregirle a mano cada
-- renglón de la orden de compra y de la factura.
--
-- ## Cómo se lee
--
-- El precio de una evaluación se resuelve así, a la fecha que decide su precio
-- (`fechaDePrecio`, el día en que se cargó el candidato):
--
--   1. Si el cliente tiene un acuerdo para esa batería vigente ese día
--      (`desde <= día` y `hasta` nula o `>= día`), vale el acuerdo.
--   2. Si no, vale la lista general (`bateria_precios`), como siempre.
--
-- `hasta` puede ser nula: un acuerdo sin fin rige hasta que se cargue otro o
-- se borre. Pasada la fecha `hasta`, el cliente vuelve solo a la lista general:
-- nadie tiene que acordarse de sacarlo.
--
-- `bateria_id` nula es el adicional Benziger. En la lista general ese
-- adicional está en dólares y se pesifica al dólar tarjeta del día; una
-- licitación lo fija en pesos, y acá se guarda ese importe en pesos. Un
-- cliente con acuerdo de baterías y sin fila de Benziger sigue pagando el
-- Benziger en dólares.
--
-- La regla de la lista general no cambia: las evaluaciones ya cargadas
-- conservan el precio que regía cuando entraron.

create table if not exists public.empresa_precios (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- Nula = adicional Benziger, en pesos.
  bateria_id uuid references public.baterias (id) on delete cascade,
  precio     numeric(12, 2) not null check (precio >= 0),
  desde      date not null,
  hasta      date,
  quien      text,
  created_at timestamptz not null default now(),

  check (hasta is null or hasta >= desde)
);

-- Dos acuerdos del mismo concepto desde el mismo día son un empate sin
-- criterio. Con `nulls not distinct` la regla alcanza también al Benziger.
create unique index if not exists empresa_precios_unico_idx
  on public.empresa_precios (empresa_id, bateria_id, desde) nulls not distinct;

create index if not exists empresa_precios_vigencia_idx
  on public.empresa_precios (empresa_id, desde desc);

alter table public.empresa_precios enable row level security;

comment on table public.empresa_precios is
  'Precios acordados con un cliente (licitaciones). Pisan la lista general mientras rigen; bateria_id nula es el adicional Benziger en pesos.';
comment on column public.empresa_precios.hasta is
  'Último día en que rige. Nula: sin fin. Pasada, el cliente vuelve a la lista general.';
