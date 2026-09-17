-- Facturar el alquiler de consultorios.
--
-- Las facturas del Centro usan la misma tabla que las de psicotécnicos: es el
-- mismo comprobante, con el mismo emisor y la misma numeración por punto de
-- venta. Lo que cambia es a quién se le factura: allá una empresa, acá un
-- inquilino.

-- Los datos fiscales de cada inquilino, que hasta ahora no se guardaban: la
-- ficha tenía los de contacto y la matrícula, y para emitir hace falta a nombre
-- de quién sale.
alter table public.inquilinos add column if not exists cuit text;
alter table public.inquilinos add column if not exists razon_social text;
alter table public.inquilinos add column if not exists condicion_iva text;
alter table public.inquilinos add column if not exists domicilio_fiscal text;

-- El receptor pasa a ser uno de los dos, y nunca los dos: una factura cobra
-- evaluaciones a una empresa, o el alquiler a un inquilino.
alter table public.facturas alter column empresa_id drop not null;
alter table public.facturas add column if not exists inquilino_id uuid
  references public.inquilinos (id);
alter table public.facturas add column if not exists periodo text;

alter table public.facturas drop constraint if exists facturas_receptor_check;
alter table public.facturas add constraint facturas_receptor_check
  check (num_nonnulls(empresa_id, inquilino_id) = 1);

create index if not exists facturas_inquilino_idx on public.facturas (inquilino_id);

-- Qué movimiento entró en cada renglón. Es lo que evita facturar dos veces el
-- mismo mes: un cargo ya facturado deja de aparecer en la cola.
alter table public.factura_items add column if not exists movimiento_id uuid
  references public.movimientos (id) on delete set null;

create index if not exists factura_items_movimiento_idx
  on public.factura_items (movimiento_id);
