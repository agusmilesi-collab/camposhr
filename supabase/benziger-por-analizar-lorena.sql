-- Los pedidos de las evaluaciones que Lorena tiene por analizar llevan Benziger.
--
-- Lo pidió ella el 28/8/2026: a esos candidatos se les tomó el perfil de
-- pensamiento, y sin la marca en el pedido la ficha no muestra la pestaña
-- (`llevaBenziger` en `lib/informe.ts`) ni reclama el cuadrante preferente.
--
-- Se marca el pedido y no la evaluación: `benziger_administrado` significa que
-- ya se tomó, y lo que se está diciendo acá es que la búsqueda lo incluye. Los
-- tres pedidos tienen un solo candidato cada uno, así que la marca no le suma
-- la pestaña a nadie más.

update pedidos p
set con_benziger = true
from evaluaciones e
join evaluadoras ev on ev.id = e.evaluadora_id
where e.pedido_id = p.id
  and e.estado = 'Por analizar'
  and ev.nombre = 'Lorena Campos';
