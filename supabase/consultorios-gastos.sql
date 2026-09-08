-- Los gastos del Centro, para saber qué queda al fin de mes.
--
-- La cuenta corriente de los inquilinos dice lo que entra. Sin lo que sale, el
-- número que se mira todos los meses ("facturé un millón y medio") no dice
-- nada: el alquiler del edificio, las expensas y la limpieza salen de ahí.
--
-- **Un gasto es del Centro y no de un inquilino.** Los cargos y los pagos de
-- una persona viven en `movimientos`, que es su cuenta; esto es la otra
-- columna del resultado y no tiene dueño.
--
-- **El período se guarda además de la fecha**, igual que en `movimientos`: la
-- factura de luz llega el 5 y corresponde al mes anterior, y el resultado se
-- arma por mes al que pertenece el gasto, no por el día en que se pagó.

create table if not exists public.gastos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  -- Primer día del mes al que corresponde. Lo pone la aplicación.
  periodo    date not null,
  concepto   text not null,
  -- Cerrada a propósito: con el rubro escrito a mano, "Luz", "luz" y
  -- "Electricidad" son tres rubros distintos y el resumen del año deja de
  -- poder agruparse.
  rubro      text not null check (
    rubro in ('alquiler', 'expensas', 'servicios', 'limpieza', 'mantenimiento', 'insumos', 'sueldos', 'otros')
  ),
  importe    numeric(12, 2) not null check (importe >= 0),
  -- Un gasto que se repite todos los meses. Todavía no genera nada solo: es
  -- para poder distinguir el alquiler del edificio de un arreglo de una vez.
  fijo       boolean not null default false,
  quien      text,
  created_at timestamptz not null default now()
);

create index if not exists gastos_periodo on public.gastos (periodo);

alter table public.gastos enable row level security;
