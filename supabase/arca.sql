-- ARCA: lo que hace falta para pedir el CAE desde el OS.
--
-- Es la segunda mitad de `CAMPOS OS/SPECS-facturacion.md` (5.2), la que
-- `facturacion.sql` dejó afuera a propósito.

-- ---------------------------------------------------------- el ticket
-- El ticket de acceso del WSAA dura 12 horas y ARCA rechaza pedir otro mientras
-- el anterior siga vigente. En Vercel el disco de la función no sobrevive entre
-- llamadas, así que el ticket se guarda acá y lo comparten todas.
--
-- `credenciales` es el ticket como lo maneja `@arcasdk/core` (cabecera, token y
-- firma), entero: partirlo en columnas obliga a rearmarlo igual al leerlo.
-- La clave lleva el ambiente porque el de homologación no sirve en producción.
create table if not exists public.arca_tickets (
  cuit         text not null,
  servicio     text not null default 'wsfe',
  ambiente     text not null default 'homologacion'
               check (ambiente in ('homologacion', 'produccion')),
  credenciales jsonb not null,
  expira_at    timestamptz not null,
  primary key (cuit, servicio, ambiente)
);

alter table public.arca_tickets enable row level security;

-- ------------------------------------------------------- el ambiente
-- Contra qué ARCA habla cada emisora. Arranca en homologación y se pasa a
-- producción a mano, cuando tenga el certificado real y el punto de venta.
alter table public.emisores add column if not exists ambiente text not null default 'homologacion'
  check (ambiente in ('homologacion', 'produccion'));

-- En qué ambiente se autorizó cada factura. Null en las cargadas a mano, que
-- son las emitidas en Comprobantes en Línea. Una de homologación tiene un CAE
-- que no vale: no cuenta para el monotributo y el comprobante lo dice.
alter table public.facturas add column if not exists ambiente text
  check (ambiente in ('homologacion', 'produccion'));

-- Lo que se le informó a ARCA y no sale de otro dato de la factura.
alter table public.facturas add column if not exists servicio_desde date;
alter table public.facturas add column if not exists servicio_hasta date;
alter table public.facturas add column if not exists vence_pago date;

-- La numeración de homologación es otra que la real y arranca en 1: sin
-- sacarla del índice, una factura de prueba puede ocuparle el número a una
-- verdadera.
drop index if exists public.facturas_numero_key;
create unique index facturas_numero_key
  on public.facturas (emisor_id, punto_venta, cbte_tipo, numero)
  where numero is not null and ambiente is distinct from 'homologacion';
create unique index if not exists facturas_numero_homologacion_key
  on public.facturas (emisor_id, punto_venta, cbte_tipo, numero)
  where numero is not null and ambiente = 'homologacion';

-- ------------------------------------------------- la empresa de prueba
-- Distribuidora Andina no tiene CUIT porque no existe. Como consumidor final
-- ARCA la acepta sin identificar, que es lo que deja probar la emisión entera.
update public.empresas set condicion_iva = 'Consumidor Final'
where nombre = 'Distribuidora Andina' and condicion_iva is null;

-- ------------------------------------------------- ingresos brutos
-- Qué dice el comprobante en "Ingresos Brutos". No es igual para todas: hay
-- quien está exenta y quien está en el régimen simplificado. Se carga con el
-- resto de lo fiscal de cada emisora, fuera del repositorio.
alter table public.emisores add column if not exists ingresos_brutos text;
