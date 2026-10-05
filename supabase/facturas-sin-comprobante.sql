-- Lo que se cobra sin emitir factura.
--
-- Es una fila de `facturas` con `sin_comprobante` en verdadero, y no una tabla
-- aparte: el trabajo recorre el mismo camino que una factura (sale de la cola,
-- queda sin cobrar, se marca cobrado) y lo único que cambia es el papel, que es
-- un recibo y no un comprobante fiscal. Con una tabla propia había que repetir
-- la lista de sin cobrar, el botón de cobro y el cruce con el portal.
--
-- No lleva número ni CAE, no se le pide nada a ARCA y no entra en la cuenta del
-- monotributo, que es sobre lo facturado.
alter table public.facturas add column if not exists sin_comprobante boolean not null default false;

-- La primera versión las guardaba aparte y ya cobradas. No llegó a usarse.
drop table if exists public.cobros_sin_factura;
