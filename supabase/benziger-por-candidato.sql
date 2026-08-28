-- El Benziger deja de decidirse solo por pedido.
--
-- Se compra por búsqueda y por eso vive en `pedidos.con_benziger`: el cliente
-- lo decide una vez y vale para todos los candidatos de ese pedido. Eso alcanzó
-- hasta que dos pedidos del mismo puesto resultaron ser uno solo: al juntarlos,
-- la marca del pedido le daba el Benziger a candidatos que no lo llevan.
--
-- La columna nueva es la excepción por candidato: se le pide a esta persona
-- aunque el pedido no lo haya comprado. No reemplaza a `benziger_administrado`,
-- que dice que ya se le tomó; esta dice que corresponde tomárselo.
alter table evaluaciones
  add column if not exists con_benziger boolean not null default false;

comment on column evaluaciones.con_benziger is
  'Le corresponde el Benziger aunque el pedido no lo pida. La marca del pedido sigue valiendo para todos sus candidatos.';

-- Esteban Auguadra lo lleva: era el único candidato del pedido que tenía la
-- marca, y al fusionarlo la pierde si no queda anotada acá.
update evaluaciones
set con_benziger = true
where id = '15507314-2e32-4c52-9692-e7669873cafb';

-- Los dos "Federada Salud · Analista de TD" son el mismo pedido, partido en dos
-- registros de Airtable creados con cuatro segundos de diferencia. Queda el del
-- 11/08, que es el que abrió la búsqueda.
update evaluaciones
set pedido_id = 'e1719d69-a528-44a1-b06e-e20347ca68a2'
where pedido_id = 'c0780700-412b-4360-b5ae-b253c5a5c950';

delete from pedidos
where id = 'c0780700-412b-4360-b5ae-b253c5a5c950';
