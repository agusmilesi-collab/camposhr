-- Cuándo se repartió entre los socios lo que dejó un trabajo.
--
-- El reparto se calcula solo (lo cobrado menos los gastos, en partes iguales
-- más lo que cada uno adelantó), pero que la cuenta esté hecha no dice si las
-- transferencias salieron. Esta fecha lo dice: null es "todavía no se
-- repartió", y volver atrás es vaciarla.
--
-- Va en la cotización porque el reparto es del trabajo entero y no de cada
-- factura ni de cada gasto.
alter table public.cotizaciones
  add column if not exists repartido_el date;
