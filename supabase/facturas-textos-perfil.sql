-- Los textos de las facturas ya cargadas, con la forma que rige desde el
-- 3/10/2026: "Perfil <puesto>, <persona>" en el renglón y en el concepto, y
-- "Adicional BTSA, <persona>" en el adicional. Antes decían "Evaluación
-- psicotécnica" y "Adicional Benziger", que no tienen que figurar en el papel
-- del cliente.
--
-- Ninguna de estas tiene CAE pedido desde el OS: son las que salieron por
-- Comprobantes en Línea y se anotaron acá, así que lo que cambia es cómo se
-- leen adentro del sistema, no un comprobante emitido.

-- El renglón de cada persona, desde su evaluación.
update public.factura_items i
set descripcion = 'Perfil ' || p.puesto || ', ' || pe.nombre
from public.evaluaciones e
join public.personas pe on pe.id = e.persona_id
join public.pedidos p on p.id = e.pedido_id
where e.id = i.evaluacion_id
  and i.descripcion ilike '%psicot%';

-- El adicional, que ya traía el nombre de la persona después del punto medio.
update public.factura_items
set descripcion = 'Adicional BTSA, ' || trim(split_part(descripcion, '·', 2))
where descripcion ilike 'Adicional Benziger ·%';

-- El concepto: una persona detrás de otra, y la orden de compra al final.
update public.facturas f
set concepto = armado.texto ||
  case when f.orden_compra is not null then ' · Orden de compra ' || f.orden_compra else '' end
from (
  select i.factura_id, string_agg(i.descripcion, ' · ' order by i.created_at, i.id) as texto
  from public.factura_items i
  where i.evaluacion_id is not null
  group by i.factura_id
) armado
where armado.factura_id = f.id
  and f.concepto ilike '%psicot%';

-- Las que no tienen ninguna persona adentro no tienen de dónde armarlo.
update public.facturas set concepto = null where concepto ilike '%psicot%';

select json_build_object(
  'renglones_psico', (select count(*) from public.factura_items where descripcion ilike '%psicot%'),
  'renglones_benziger', (select count(*) from public.factura_items where descripcion ilike '%benziger%'),
  'conceptos_psico', (select count(*) from public.facturas where concepto ilike '%psicot%'),
  'ejemplos', (select json_agg(t) from (select concepto from public.facturas where concepto like 'Perfil %' order by fecha desc limit 3) t),
  'sin_concepto', (select count(*) from public.facturas where concepto is null)
) as resultado;

-- Algunos puestos están guardados con un espacio al final, y quedaba
-- "Perfil Asesor comercial , Nombre Apellido".
update public.factura_items set descripcion = regexp_replace(descripcion, '\s+,', ',', 'g')
where descripcion like 'Perfil %' and descripcion ~ '\s,';
update public.facturas set concepto = regexp_replace(concepto, '\s+,', ',', 'g')
where concepto like 'Perfil %' and concepto ~ '\s,';
