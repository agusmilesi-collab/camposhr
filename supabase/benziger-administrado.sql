-- Si el Benziger ya se le tomó.
--
-- No está en la lista de tests de ninguna batería: es un adicional que el
-- pedido lleva o no (`pedidos.con_benziger`), así que su marca vive en la
-- evaluación como la del Bender y la del gráfico.
--
-- Hace falta para saber cuándo la entrevista está completa: sin esto, una
-- evaluación con Benziger quedaría lista para analizar antes de tenerlo.

alter table evaluaciones add column if not exists benziger_administrado boolean not null default false;

comment on column evaluaciones.benziger_administrado is
  'Si se le tomó el Benziger. Se pone solo al cargar su informe.';

-- Las que ya tienen su informe cargado, ya lo tomaron.
update evaluaciones e
   set benziger_administrado = true
  from benziger b
 where b.evaluacion_id = e.id
   and b.cuadrantes is not null;
