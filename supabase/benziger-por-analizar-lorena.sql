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

-- Y Esteban Auguadra (Federada Salud, Analista de TD), que está por entrevistar:
-- se sumó el mismo día, por el mismo pedido de Lorena. Su pedido también tiene
-- un solo candidato.
update pedidos
set con_benziger = true
where id = 'c0780700-412b-4360-b5ae-b253c5a5c950';
