-- Los datos de un cliente que hacían falta para facturarle y para llamarlo.
--
-- Estaban solo en la tabla Empresas de Airtable. Se suman acá porque la
-- pantalla de Clientes del OS pasa a ser la tabla de clientes: si el alta no
-- puede cargar la condición de IVA, el alta no sirve y hay que ir igual a
-- Airtable.
--
-- `airtable_id` ya existía, del esquema de psicotécnicos: es el puente
-- mientras las dos mitades convivan.

alter table public.empresas add column if not exists razon_social       text;
alter table public.empresas add column if not exists cuit               text;
alter table public.empresas add column if not exists condicion_iva      text;
alter table public.empresas add column if not exists direccion_fiscal   text;
alter table public.empresas add column if not exists email_facturacion  text;
alter table public.empresas add column if not exists contacto           text;
alter table public.empresas add column if not exists rubro              text;
alter table public.empresas add column if not exists tamano             integer;
alter table public.empresas add column if not exists notas              text;
alter table public.empresas add column if not exists created_at_orden   timestamptz;

comment on column public.empresas.tamano is 'Cuántas personas trabajan en el cliente.';
