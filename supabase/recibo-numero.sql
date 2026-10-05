-- El número del recibo de lo que se cobra sin factura.
--
-- Es una numeración propia y corrida, que no tiene nada que ver con la de los
-- comprobantes: sirve para que el cliente y el equipo nombren el mismo papel
-- cuando hablan del pago ("el recibo 14").
alter table public.facturas add column if not exists recibo_numero integer;
create unique index if not exists facturas_recibo_numero_key
  on public.facturas (recibo_numero) where recibo_numero is not null;

-- Los que ya existían, en el orden en que se hicieron.
with orden as (
  select id, row_number() over (order by created_at) as n
  from public.facturas where sin_comprobante and recibo_numero is null
)
update public.facturas f
set recibo_numero = orden.n + coalesce((select max(recibo_numero) from public.facturas), 0)
from orden where orden.id = f.id;

select json_agg(json_build_object('id', id, 'n', recibo_numero)) from public.facturas where sin_comprobante;
