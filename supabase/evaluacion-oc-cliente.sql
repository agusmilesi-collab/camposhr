-- La orden de compra del cliente, guardada en la evaluación.
--
-- Hay clientes que mandan su propia orden de compra (Cofco la llama "nota de
-- pedido") y la exigen impresa en la factura. Hasta hoy se escribía recién al
-- facturar, de memoria o buscando el PDF. Guardada en la evaluación, el
-- formulario de facturar la propone sola con las tildadas.
--
-- Son dos porque Cofco manda una por la factura en pesos (las baterías) y
-- otra por la factura en dólares (el Benziger): cada factura lleva la suya.

alter table public.evaluaciones
  add column if not exists oc_cliente text,
  add column if not exists oc_cliente_usd text;

comment on column public.evaluaciones.oc_cliente is
  'Orden de compra del cliente para la factura en pesos de esta evaluación.';
comment on column public.evaluaciones.oc_cliente_usd is
  'Orden de compra del cliente para la factura en dólares (Benziger) de esta evaluación.';

-- Cofco, 14/10/2026: las tres órdenes de compra que mandó.
update public.evaluaciones set oc_cliente = '4503396844', oc_cliente_usd = '4503396847'
where id in ('658ee92d-43f5-4c4b-bfac-f9fb55e773c6', '3182f54a-6572-4d87-b363-98755a62ecd2');
update public.evaluaciones set oc_cliente_usd = '4503394936'
where id = 'ff8c6e13-fd55-443b-9e57-7d32b01389cb';

notify pgrst, 'reload schema';
