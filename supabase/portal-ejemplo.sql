-- Portal de ejemplo: la empresa ficticia que se muestra desde la página de
-- psicotécnicos (camposhr.com/psicotecnicos).
--
-- Existe para poder mostrar el portal sin abrir el de un cliente real. Todo lo
-- que hay adentro es inventado: la empresa, las tres personas, el pedido y el
-- protocolo del informe. El nombre lleva "(ejemplo)" a propósito, porque la
-- empresa también se ve en el OS y ahí tiene que distinguirse del trabajo real.
--
-- Escenario: una búsqueda de Batería 3 con Benziger, con dos candidatos en
-- curso (uno por entrevistar y otro por analizar) y uno entregado con su
-- informe completo.

begin;

insert into empresas (nombre, slug, activa, informes_visibles, portal_desde_airtable, token_portal, rubro, contacto)
values ('Vega Materiales (ejemplo)', 'vega-materiales-ejemplo', true, true, false,
        'v_Ej3mPl0Portal7Kq2Zt8Rw5Nc1Yb', 'Materiales de construcción', 'Recursos Humanos')
on conflict (slug) do nothing;

insert into pedidos (
  empresa_id, bateria_id, puesto, familia, seniority, estado, fecha_pedido, con_benziger,
  puesto_problemas, puesto_presion, puesto_interaccion, puesto_estabilidad,
  puesto_contacto_jefe, puesto_innovacion, jefe_estilo, jefe_paciencia, jefe_emociones,
  origen, notas
)
select em.id, b.id, 'Jefe de Planta', 'Operaciones', 'Jefatura', 'En curso', current_date - 21, true,
       'Problemas complejos', 'Todos los días', 'Muchas personas', 'Cambios moderados',
       'Una vez al día', 'Algo de espacio', 'Delegador', 'Poca', 'Más o menos',
       'portal', 'Reemplazo de una jefatura que se jubila en noviembre.'
from empresas em, baterias b
where em.slug = 'vega-materiales-ejemplo' and b.codigo = 'Batería 3';

insert into personas (empresa_id, nombre, email, telefono, origen)
select em.id, x.nombre, x.email, x.telefono, 'portal'
from empresas em,
     (values
       ('Verónica Sandoval', 'veronica.sandoval@example.com', '+54 9 341 000 0001'),
       ('Damián Ferrero', 'damian.ferrero@example.com', '+54 9 341 000 0002'),
       ('Rocío Bermúdez', 'rocio.bermudez@example.com', '+54 9 341 000 0003')
     ) as x(nombre, email, telefono)
where em.slug = 'vega-materiales-ejemplo';

-- La entregada: informe completo, facturada y cobrada.
insert into evaluaciones (
  persona_id, pedido_id, evaluadora_id, estado, modalidad,
  fecha_ingreso, fecha_entrevista, fecha_entrega,
  bender_administrado, grafico_2_personas_administrado, proyectivo_administrado,
  benziger_administrado, recomendacion, facturado, pagado, edad,
  entrevista_competencias
)
select p.id, pe.id, ev.id, 'Entregado', 'Presencial',
       current_date - 21, (current_date - 15)::timestamptz + interval '10 hours', current_date - 11,
       true, true, true, true, 'Apto con observaciones', true, true, 41,
       'Condujo la puesta en marcha de una línea nueva con el plantel repartido en dos turnos. Cuenta que el conflicto con el turno noche lo resolvió sentándose con los dos encargados por separado antes de la reunión general.'
from personas p, pedidos pe, empresas em, evaluadoras ev
where p.nombre = 'Verónica Sandoval' and em.slug = 'vega-materiales-ejemplo'
  and p.empresa_id = em.id and pe.empresa_id = em.id and ev.nombre = 'Lorena Campos';

-- En curso: entrevistada, pendiente de análisis.
insert into evaluaciones (
  persona_id, pedido_id, evaluadora_id, estado, modalidad,
  fecha_ingreso, fecha_entrevista,
  bender_administrado, grafico_2_personas_administrado, proyectivo_administrado,
  benziger_administrado, edad
)
-- Entrevistado ayer: su entrega estimada (tres días hábiles) tiene que caer
-- adelante, o la muestra se lee como si el informe estuviera demorado.
select p.id, pe.id, ev.id, 'Por analizar', 'Online',
       current_date - 12, (current_date - 1)::timestamptz + interval '13 hours',
       true, true, true, true, 37
from personas p, pedidos pe, empresas em, evaluadoras ev
where p.nombre = 'Damián Ferrero' and em.slug = 'vega-materiales-ejemplo'
  and p.empresa_id = em.id and pe.empresa_id = em.id and ev.nombre = 'Lucila Campos';

-- En curso: con fecha puesta, todavía sin entrevistar.
insert into evaluaciones (
  persona_id, pedido_id, evaluadora_id, estado, modalidad,
  fecha_ingreso, fecha_entrevista, edad
)
select p.id, pe.id, ev.id, 'Por entrevistar', 'Presencial',
       current_date - 6, (current_date + 3)::timestamptz + interval '15 hours', 34
from personas p, pedidos pe, empresas em, evaluadoras ev
where p.nombre = 'Rocío Bermúdez' and em.slug = 'vega-materiales-ejemplo'
  and p.empresa_id = em.id and pe.empresa_id = em.id and ev.nombre = 'Lorena Campos';

commit;
