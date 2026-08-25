-- De qué trabajo es una factura de servicios.
--
-- Una cotización aprobada es un trabajo vendido, y con el tiempo junta dos
-- cosas: lo que costó (los gastos que cuelgan de ella) y lo que se cobró. Lo
-- segundo faltaba: las facturas de servicios no decían a qué trabajo
-- pertenecían, así que la pantalla podía mostrar el ingreso cotizado o el
-- facturado, pero nunca los dos en la misma fila.
--
-- Va en la factura y no al revés porque un trabajo se puede facturar en varios
-- comprobantes: el ciclo de Pla se reparte entre los tres y cada uno emite el
-- suyo con su CUIT. Al revés no entraría.
--
-- Admite null: una factura de un servicio que nunca se cotizó formalmente sigue
-- siendo una factura, y obligar a inventarle una cotización para poder
-- cargarla haría que no se cargue.
alter table public.facturas
  add column if not exists cotizacion_id uuid references public.cotizaciones (id);

create index if not exists facturas_cotizacion_idx
  on public.facturas (cotizacion_id) where cotizacion_id is not null;

comment on column public.facturas.cotizacion_id is
  'El trabajo que esta factura cobra. Null si no salió de una cotización.';
