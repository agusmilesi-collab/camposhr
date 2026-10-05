-- La orden de compra: el papel que dice qué se pidió, para quién y cuánto sale.
--
-- Nace cada vez que se cargan candidatos, los cargue el cliente desde su portal
-- o el equipo desde el OS, y cubre a los que entraron en esa carga. Un pedido
-- puede tener varias: la primera con los tres candidatos del arranque y otra
-- con los dos que se sumaron después.
--
-- **No es una factura y no vive en `facturas`.** La factura llega después, y
-- una evaluación entra en una sola: si la orden ocupara ese lugar, lo pedido
-- nunca llegaría a la cola de facturación.
--
-- El importe queda congelado en la orden. El precio de la batería es el de la
-- fecha del pedido, y el adicional en dólares va al dólar tarjeta del día como
-- referencia: lo que se factura es al dólar del día de facturación, y la orden
-- lo dice.

create sequence if not exists public.ordenes_compra_numero_seq;

-- La numeración sigue a la de los recibos que ya se entregaron con este mismo
-- nombre ("Orden de compra #0001"): no puede haber dos papeles con un número.
select setval(
  'public.ordenes_compra_numero_seq',
  greatest(
    (select coalesce(max(recibo_numero), 0) from public.facturas),
    (select last_value from public.ordenes_compra_numero_seq)
  )
);

create table if not exists public.ordenes_compra (
  id             uuid primary key default gen_random_uuid(),
  numero         integer not null unique default nextval('public.ordenes_compra_numero_seq'),
  -- Con esto la baja el cliente, sin sesión: es toda su credencial.
  token          text not null unique,
  empresa_id     uuid not null references public.empresas (id),
  pedido_id      uuid references public.pedidos (id) on delete set null,
  solicitante_id uuid references public.contactos (id) on delete set null,
  -- El día de acá y no el del servidor, que desde las 21:00 ya es mañana.
  fecha          date not null default ((now() at time zone 'America/Argentina/Cordoba')::date),
  dolar_tarjeta  numeric(12,2),
  total          numeric(12,2) not null,
  origen         text not null default 'portal' check (origen in ('portal', 'os')),
  created_at     timestamptz not null default now()
);

create index if not exists ordenes_compra_empresa_idx on public.ordenes_compra (empresa_id, fecha desc);
create index if not exists ordenes_compra_pedido_idx on public.ordenes_compra (pedido_id);

alter table public.ordenes_compra enable row level security;

create table if not exists public.orden_items (
  id            uuid primary key default gen_random_uuid(),
  orden_id      uuid not null references public.ordenes_compra (id) on delete cascade,
  evaluacion_id uuid references public.evaluaciones (id) on delete set null,
  posicion      integer not null default 0,
  concepto      text not null,
  -- Sobre quién: el nombre de la persona.
  detalle       text,
  -- La aclaración del renglón, que la orden dice una sola vez al pie.
  nota          text,
  importe       numeric(12,2),
  created_at    timestamptz not null default now()
);

create index if not exists orden_items_orden_idx on public.orden_items (orden_id, posicion);
create index if not exists orden_items_evaluacion_idx on public.orden_items (evaluacion_id);

alter table public.orden_items enable row level security;

-- La tabla ya existía con `current_date`: se le cambia el valor por defecto.
alter table public.ordenes_compra
  alter column fecha set default ((now() at time zone 'America/Argentina/Cordoba')::date);
