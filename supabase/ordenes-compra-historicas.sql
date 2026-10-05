-- Una orden de compra para cada candidato que se cargó antes de que existieran.
--
-- La orden nace con la carga desde el 5/10/2026. Lo anterior no tenía ninguna,
-- y en la ficha el lugar de la orden mostraba solo un importe. Acá se les arma
-- la suya, con la misma regla que rige para las nuevas, reconstruida:
--
--   - **Una orden por carga**: los candidatos de un mismo pedido que entraron
--     el mismo día van juntos, que es lo más parecido a "lo que se cargó de una
--     vez" que se puede saber hoy.
--   - **La fecha de la orden es la de esa carga**, no la de hoy.
--   - **El importe es el que se facturó**, cuando ya se facturó: es lo que de
--     verdad salió. Si todavía no, el precio de la batería a la fecha del
--     pedido, y el adicional al dólar de referencia de hoy, dicho en la nota.
--
-- Los números siguen a los que ya había, en orden de fecha entre ellas. Quedan
-- más altos que el de órdenes posteriores hechas a mano: la numeración dice en
-- qué orden se emitieron, y estas se emiten hoy.
--
-- La empresa de muestra del portal queda afuera: no es trabajo.
-- Se puede correr dos veces: lo que ya tiene orden no se toca.

-- ---------------------------------------------- las tres que ya tenían número
-- Las primeras órdenes se hicieron desde la fila "sin factura" y guardaron su
-- número en la factura. Pasan a la tabla de órdenes con ese mismo número.
insert into public.ordenes_compra
  (numero, token, empresa_id, pedido_id, solicitante_id, fecha, dolar_tarjeta, total, origen)
select
  f.recibo_numero,
  'oc_' || translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_x'),
  f.empresa_id,
  (select e.pedido_id from public.factura_items i
     join public.evaluaciones e on e.id = i.evaluacion_id
    where i.factura_id = f.id limit 1),
  (select coalesce(e.solicitante_id, p.solicitante_id) from public.factura_items i
     join public.evaluaciones e on e.id = i.evaluacion_id
     join public.pedidos p on p.id = e.pedido_id
    where i.factura_id = f.id limit 1),
  f.fecha, f.dolar_tarjeta, coalesce(f.imp_total, 0), 'os'
from public.facturas f
where f.sin_comprobante and f.recibo_numero is not null and f.empresa_id is not null
  and not exists (select 1 from public.ordenes_compra o where o.numero = f.recibo_numero);

insert into public.orden_items (orden_id, evaluacion_id, posicion, concepto, detalle, nota, importe)
select
  o.id,
  coalesce(
    i.evaluacion_id,
    (select i2.evaluacion_id from public.factura_items i2
       join public.evaluaciones e2 on e2.id = i2.evaluacion_id
       join public.personas p2 on p2.id = e2.persona_id
      where i2.factura_id = f.id and i.descripcion = 'Adicional BTSA, ' || trim(p2.nombre)
      limit 1)
  ),
  row_number() over (
    partition by f.id
    order by coalesce(trim(pe.nombre), substr(i.descripcion, 17)), (i.evaluacion_id is null)
  ) - 1,
  case
    when i.evaluacion_id is not null then 'Perfil ' || trim(p.puesto)
    when i.descripcion like 'Adicional BTSA, %' then 'Adicional BTSA'
    else i.descripcion
  end,
  case
    when i.evaluacion_id is not null then trim(pe.nombre)
    when i.descripcion like 'Adicional BTSA, %' then substr(i.descripcion, 17)
  end,
  null,
  i.importe
from public.facturas f
join public.ordenes_compra o on o.numero = f.recibo_numero
join public.factura_items i on i.factura_id = f.id
left join public.evaluaciones e on e.id = i.evaluacion_id
left join public.pedidos p on p.id = e.pedido_id
left join public.personas pe on pe.id = e.persona_id
where f.sin_comprobante and f.recibo_numero is not null
  and not exists (select 1 from public.orden_items x where x.orden_id = o.id);

-- ------------------------------------------------------- todas las demás
-- Primero las órdenes, una por pedido y día de carga, en orden de fecha.
with pend as (
  select e.pedido_id, p.empresa_id,
         coalesce(e.solicitante_id, p.solicitante_id) as solicitante,
         coalesce(e.fecha_ingreso, e.created_at::date) as dia
  from public.evaluaciones e
  join public.pedidos p on p.id = e.pedido_id
  join public.empresas m on m.id = p.empresa_id
  where m.nombre <> 'Vega Materiales (ejemplo)'
    and not exists (select 1 from public.orden_items oi where oi.evaluacion_id = e.id)
),
grupos as (
  select pedido_id, dia,
         (array_agg(empresa_id))[1] as empresa_id,
         (array_agg(solicitante) filter (where solicitante is not null))[1] as solicitante
  from pend group by pedido_id, dia
)
insert into public.ordenes_compra (token, empresa_id, pedido_id, solicitante_id, fecha, total, origen)
select 'oc_' || translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_x'),
       empresa_id, pedido_id, solicitante, dia, 0, 'os'
from grupos
order by dia, pedido_id;

-- Después sus renglones: el perfil de cada persona y, si lo lleva, su adicional.
with pend as (
  select e.id as evaluacion_id, e.pedido_id, trim(pe.nombre) as nombre, trim(p.puesto) as puesto,
         coalesce(e.fecha_ingreso, e.created_at::date) as dia,
         (coalesce(e.con_benziger, false) or coalesce(e.benziger_administrado, false)
            or coalesce(p.con_benziger, false)) as lleva_adicional,
         fi.factura_id,
         fi.importe as facturado,
         (select bp.precio from public.bateria_precios bp
           where bp.bateria_id = p.bateria_id and bp.desde::date <= coalesce(p.fecha_pedido, current_date)
           order by bp.desde desc limit 1) as de_lista
  from public.evaluaciones e
  join public.pedidos p on p.id = e.pedido_id
  join public.empresas m on m.id = p.empresa_id
  join public.personas pe on pe.id = e.persona_id
  left join public.factura_items fi on fi.evaluacion_id = e.id
  where m.nombre <> 'Vega Materiales (ejemplo)'
    and not exists (select 1 from public.orden_items oi where oi.evaluacion_id = e.id)
),
con_orden as (
  select pend.*, o.id as orden_id,
         row_number() over (partition by o.id order by pend.nombre, pend.evaluacion_id) as n,
         (select i.importe from public.factura_items i
           where i.factura_id = pend.factura_id and i.evaluacion_id is null
             and i.descripcion = 'Adicional BTSA, ' || pend.nombre
           limit 1) as adicional_facturado,
         (select dolar_tarjeta from public.ordenes_compra
           where dolar_tarjeta is not null order by created_at desc limit 1) as dolar
  from pend
  join public.ordenes_compra o
    on o.pedido_id = pend.pedido_id and o.fecha = pend.dia
   and not exists (select 1 from public.orden_items x where x.orden_id = o.id)
)
insert into public.orden_items (orden_id, evaluacion_id, posicion, concepto, detalle, nota, importe)
select orden_id, evaluacion_id, n * 2, 'Perfil ' || puesto, nombre, null, coalesce(facturado, de_lista)
from con_orden
union all
select orden_id, evaluacion_id, n * 2 + 1, 'Adicional BTSA', nombre,
       case when factura_id is null
         then 'Adicional BTSA: USD 40, que se facturan al dólar tarjeta del día de facturación. '
              || 'El importe de esta orden usa como referencia el del ' || to_char(current_date, 'DD/MM/YYYY')
              || ' ($ ' || replace(to_char(dolar, 'FM999G999'), ',', '.') || ').'
       end,
       case when factura_id is null then round(40 * dolar) else adicional_facturado end
from con_orden
where (factura_id is null and lleva_adicional and dolar is not null)
   or (factura_id is not null and adicional_facturado is not null);

-- Y el total de cada una, que es la suma de lo suyo.
update public.ordenes_compra o
set total = coalesce((select sum(importe) from public.orden_items i where i.orden_id = o.id), 0);

-- El dólar de referencia queda anotado en las que lo usaron.
update public.ordenes_compra o
set dolar_tarjeta = (select dolar_tarjeta from public.ordenes_compra
                      where dolar_tarjeta is not null order by created_at desc limit 1)
where o.dolar_tarjeta is null
  and exists (select 1 from public.orden_items i where i.orden_id = o.id and i.nota is not null);

select json_build_object(
  'ordenes', (select count(*) from public.ordenes_compra),
  'renglones', (select count(*) from public.orden_items),
  'candidatos_sin_orden', (
    select count(*) from public.evaluaciones e
    join public.pedidos p on p.id = e.pedido_id join public.empresas m on m.id = p.empresa_id
    where m.nombre <> 'Vega Materiales (ejemplo)'
      and not exists (select 1 from public.orden_items oi where oi.evaluacion_id = e.id)),
  'ordenes_vacias', (select count(*) from public.ordenes_compra o
    where not exists (select 1 from public.orden_items i where i.orden_id = o.id)),
  'renglones_sin_importe', (select count(*) from public.orden_items where importe is null),
  'numeros', (select min(numero) || ' a ' || max(numero) from public.ordenes_compra),
  'total', (select sum(total) from public.ordenes_compra)
) as resultado;
