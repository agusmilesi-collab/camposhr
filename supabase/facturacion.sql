-- Facturación: el registro de lo que ya se emitió.
--
-- Es la primera mitad de `CAMPOS OS/SPECS-facturacion.md`, la que no depende de
-- ARCA. Las tablas son las que ese spec define en 5.2, con tres diferencias que
-- vienen de mirar las 24 facturas reales que hoy viven en Airtable:
--
--   1. `cuit` y `punto_venta` del emisor admiten null. El spec los pide para
--      emitir; para registrar lo ya emitido alcanza con saber quién facturó.
--      Se completan cuando se tramiten los certificados.
--   2. `cobrada_at` es una columna nueva. El spec modela el estado del
--      comprobante (borrador, emitida, rechazada, anulada) y Airtable modela el
--      del cobro (Enviada, Cobrada). Son dos ejes distintos y hacen falta los
--      dos: una factura emitida y no cobrada es la situación normal.
--   3. `airtable_id` y `origen`, para el puente de la migración y para saber
--      después cuáles nacieron acá.
--
-- Lo que este archivo NO crea: `arca_tickets` y las columnas de certificado y
-- ambiente. Eso entra cuando entre ARCA, que según el spec va después de tener
-- cuentas reales por persona.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- emisores
-- Quién factura. Cada evaluadora es monotributista y factura lo suyo, con su
-- propia numeración: por eso el número de comprobante no es único en la tabla
-- de facturas sino dentro de cada emisor.
create table if not exists public.emisores (
  id              uuid primary key default gen_random_uuid(),
  evaluadora_id   uuid not null unique references public.evaluadoras (id),
  cuit            text unique,
  razon_social    text not null,
  nombre_fantasia text,
  condicion_iva   text not null default 'Monotributo',
  categoria       text,
  punto_venta     integer,
  domicilio       text,
  inicio_actividades date,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.emisores enable row level security;

-- --------------------------------------------------------------- facturas
-- Una fila por comprobante. `cbte_tipo` 11 es la factura C, la única que emite
-- un monotributista, y en C el total es igual al neto porque el IVA es cero.
create table if not exists public.facturas (
  id            uuid primary key default gen_random_uuid(),
  airtable_id   text,
  origen        text not null default 'os' check (origen in ('os', 'airtable')),

  emisor_id     uuid not null references public.emisores (id),
  empresa_id    uuid not null references public.empresas (id),

  cbte_tipo     integer not null default 11,
  punto_venta   integer,
  numero        integer,
  fecha         date not null,

  doc_tipo      integer not null default 80,
  doc_nro       text,
  condicion_iva_receptor integer,

  imp_total     numeric(12,2),
  moneda        text not null default 'PES',

  orden_compra  text,
  dolar_tarjeta numeric(12,2),
  dolar_fecha   timestamptz,
  concepto      text,
  notas         text,

  cae           text,
  cae_vence_el  date,
  estado        text not null default 'borrador'
                check (estado in ('borrador','emitida','rechazada','anulada')),

  -- El cobro, que es otro eje: una factura emitida puede estar sin cobrar.
  cobrada_at    date,

  pdf_path      text,
  enviada_at    timestamptz,
  enviada_a     text[],
  solicitud     jsonb,
  respuesta     jsonb,
  quien         text,
  created_at    timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create unique index if not exists facturas_airtable_id_key
  on public.facturas (airtable_id) where airtable_id is not null;
-- La numeración es por emisor y punto de venta, nunca global.
create unique index if not exists facturas_numero_key
  on public.facturas (emisor_id, punto_venta, cbte_tipo, numero)
  where numero is not null;
create index if not exists facturas_empresa_idx on public.facturas (empresa_id);
create index if not exists facturas_fecha_idx on public.facturas (fecha desc);

alter table public.facturas enable row level security;

-- ------------------------------------------------------------- renglones
-- Qué evaluaciones entraron en cada factura. Es lo que permite responder
-- "¿esta persona ya se facturó?" sin leerlo de un campo escrito a mano.
create table if not exists public.factura_items (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas (id) on delete cascade,
  evaluacion_id   uuid references public.evaluaciones (id) on delete set null,
  descripcion     text not null,
  cantidad        numeric(12,2) not null default 1,
  precio_unitario numeric(12,2),
  importe         numeric(12,2),
  created_at      timestamptz not null default now()
);

-- Una evaluación no se factura dos veces.
create unique index if not exists factura_items_evaluacion_idx
  on public.factura_items (evaluacion_id) where evaluacion_id is not null;
create index if not exists factura_items_factura_idx
  on public.factura_items (factura_id);

alter table public.factura_items enable row level security;

-- --------------------------------------------------- órdenes de compra
-- Cofco y los que trabajan igual rechazan la factura que no imprime su número
-- de orden. Es una condición de emisión y por eso vive en el cliente.
alter table public.empresas add column if not exists exige_orden_compra boolean not null default false;
alter table public.pedidos  add column if not exists orden_compra text;

-- --------------------------------------------------------- actualizado_at
drop trigger if exists facturas_tocar on public.facturas;
create trigger facturas_tocar before update on public.facturas
  for each row execute function public.tocar_actualizado();

-- ------------------------------------------------------- las dos emisoras
-- Lorena y Lucila ya están en `evaluadoras`. Los dos monotributos son
-- distintos, pero **el comprobante sale igual para las dos**: el cliente
-- contrata a Campos HR y no a una de ellas, así que el nombre de fantasía es el
-- mismo y lo único que cambia es la razón social, el CUIT y la numeración, que
-- son de cada una.
--
-- **Los CUIT no van acá.** Este repositorio es público y un CUIT es un dato
-- personal: se cargan con `camposhr-privado/emisores-cuit.sql`, que vive fuera
-- del repo. Lo mismo el punto de venta y el domicilio, cuando se tramiten los
-- certificados. Estas dos filas son la cáscara, y sin CUIT no se puede emitir,
-- que es exactamente lo que corresponde hasta que alguien los cargue.
insert into public.emisores (evaluadora_id, razon_social, nombre_fantasia)
select id, 'Campos Lorena Virginia', 'CAMPOS HR'
from public.evaluadoras where nombre = 'Lorena Campos'
on conflict (evaluadora_id) do update set
  razon_social = excluded.razon_social,
  nombre_fantasia = excluded.nombre_fantasia;

insert into public.emisores (evaluadora_id, razon_social, nombre_fantasia)
select id, 'Campos Lucila Graciela', 'CAMPOS HR'
from public.evaluadoras where nombre = 'Lucila Campos'
on conflict (evaluadora_id) do update set
  razon_social = excluded.razon_social,
  nombre_fantasia = excluded.nombre_fantasia;

-- ------------------------------------------------- el renglón, en dos líneas
-- El comprobante imprime dos: qué se hizo y a quién, y debajo con qué batería y
-- cuándo se entregó. Lo segundo no cabe en `descripcion` sin volverla ilegible
-- en la tabla del OS, que muestra una línea por renglón.
alter table public.factura_items add column if not exists detalle text;
