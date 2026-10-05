-- El recibo de pago: el papel que se le da al cliente cuando entra la plata.
--
-- Cierra el circuito que abre la orden de compra: se pide (orden), se hace el
-- trabajo y se factura, y cuando se cobra se entrega el recibo. Sale al marcar
-- el cobro en Facturación, para cualquier fila, tenga factura o vaya sin ella.
--
-- Tiene su numeración, corrida y aparte de la de las órdenes y de la de las
-- facturas. El número se pone la primera vez que se marca el cobro y no se
-- borra si después se desmarca: ese recibo ya pudo haberse entregado, y volver
-- a marcarlo tiene que dar el mismo número y no uno nuevo.
create sequence if not exists public.recibos_pago_numero_seq;

alter table public.facturas add column if not exists recibo_pago_numero integer;
create unique index if not exists facturas_recibo_pago_numero_key
  on public.facturas (recibo_pago_numero) where recibo_pago_numero is not null;

-- La API de datos no puede pedirle un valor a una secuencia; esta función lo
-- hace y lo guarda en un solo paso, que además evita que dos cobros marcados
-- a la vez se lleven el mismo número.
create or replace function public.asignar_recibo_pago(factura uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.facturas
  set recibo_pago_numero = coalesce(recibo_pago_numero, nextval('public.recibos_pago_numero_seq')::integer)
  where id = factura
  returning recibo_pago_numero;
$$;

-- Solo la usa el servidor, con la clave de servicio.
revoke all on function public.asignar_recibo_pago(uuid) from public, anon, authenticated;
grant execute on function public.asignar_recibo_pago(uuid) to service_role;

notify pgrst, 'reload schema';
