-- Cómo entró la plata de cada cobro (6/10/2026).
--
-- El recibo de pago decía siempre "Transferencia bancaria". Hay clientes que
-- pagan en efectivo y el recibo tiene que decirlo. Se elige al marcar el
-- cobro. Null es transferencia, que es lo que fueron todos hasta hoy.
alter table public.facturas add column if not exists forma_pago text
  check (forma_pago in ('transferencia', 'efectivo'));
notify pgrst, 'reload schema';
