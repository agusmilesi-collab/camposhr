-- El Benziger en dólares sale en una factura aparte, en dólares.
--
-- Hasta hoy el adicional Benziger (USD 40) se pesificaba al dólar tarjeta del
-- día y entraba como un renglón más de la factura en pesos. Cofco, por su
-- licitación, lo paga en dólares: lo que está en dólares se le factura en
-- dólares, en un segundo comprobante (decisión de Agustín, 14/10/2026). Es
-- una marca por cliente y hoy la tiene solo Cofco; el resto sigue como antes.
--
-- Con la marca, la factura en pesos lleva solo las baterías, y el OS genera a
-- la vez una segunda factura C en moneda DOL con un renglón de USD 40 por
-- candidato. ARCA la autoriza con la cotización oficial del BNA (divisa
-- vendedor) del día hábil anterior, que el OS le pide a ARCA mismo
-- (`FEParamGetCotizacion`) y guarda en `mon_cotiz` para que el comprobante
-- siga explicando su total. Un Benziger acordado en pesos (`empresa_precios`)
-- no va aparte: ya está en pesos.
--
-- `hermana_id` une la factura en dólares con la factura en pesos de la que es
-- el adicional: son dos comprobantes por el mismo trabajo.

alter table public.empresas
  add column if not exists benziger_en_dolares boolean not null default false;

alter table public.facturas
  add column if not exists mon_cotiz numeric(12, 4),
  add column if not exists mon_cotiz_fecha date,
  add column if not exists hermana_id uuid references public.facturas (id) on delete set null;

create index if not exists facturas_hermana_idx on public.facturas (hermana_id);

comment on column public.empresas.benziger_en_dolares is
  'El adicional Benziger se le factura en dólares, en una factura aparte (licitación de Cofco).';
comment on column public.facturas.mon_cotiz is
  'Cotización con la que ARCA autorizó una factura en moneda extranjera (BNA divisa vendedor).';
comment on column public.facturas.hermana_id is
  'En una factura en dólares, la factura en pesos de la que es el adicional.';

update public.empresas set benziger_en_dolares = true
where id = 'f78d70d6-ce0c-47db-9387-62d2b55f39c6';

notify pgrst, 'reload schema';
