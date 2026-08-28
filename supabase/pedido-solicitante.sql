-- Quién pidió esta búsqueda.
--
-- El informe lo nombra debajo de la empresa: el documento va a circular entre
-- gente que no estuvo en el pedido, y "quién pidió esto" es la primera pregunta
-- de quien lo recibe reenviado.
--
-- Es una de las personas del cliente (`contactos`), no un texto suelto: ahí ya
-- están el cargo y el mail, y `pide` marca a quienes piden evaluaciones.
--
-- Admite null: los pedidos que vinieron de Airtable no lo traen, y ahí el
-- informe se queda con la única persona que pide de esa empresa, si hay una
-- sola. Con dos no adivina y no dice nada.
alter table pedidos
  add column if not exists solicitante_id uuid references contactos(id) on delete set null;

comment on column pedidos.solicitante_id is
  'Quién pidió la búsqueda, de los contactos de esa empresa. Sale en el informe debajo de la empresa.';

-- Las empresas con una sola persona que pide quedan resueltas de entrada: es la
-- misma cuenta que haría el informe, hecha una vez.
update pedidos p
set solicitante_id = c.id
from (
  select empresa_id, min(id::text)::uuid as id
  from contactos
  where pide and activo
  group by empresa_id
  having count(*) = 1
) c
where p.empresa_id = c.empresa_id and p.solicitante_id is null;
