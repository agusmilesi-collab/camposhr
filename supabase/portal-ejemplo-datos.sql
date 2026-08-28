-- El resto de lo que lleva el informe del portal de ejemplo: perfil de
-- pensamiento, test cognitivo y análisis discursivo. Todo inventado, con las
-- cuentas internas cuadradas (los tres bloques suman el total del adulto) para
-- que el informe se dibuje igual que uno de verdad.

begin;

insert into benziger (evaluacion_id, cuadrantes, cuadrante_preferente, estres, cuadrantes_parejos, pdf_nombre)
select e.id,
  jsonb_build_object(
    'trabajo_fi', 42, 'trabajo_bi', 36, 'trabajo_fd', 28, 'trabajo_bd', 24,
    'autopercepcion_fi', 30, 'autopercepcion_bi', 26, 'autopercepcion_fd', 22, 'autopercepcion_bd', 20,
    'tiempolibre_fi', 22, 'tiempolibre_bi', 20, 'tiempolibre_fd', 18, 'tiempolibre_bd', 16,
    'total_adulto_fi', 94, 'total_adulto_bi', 82, 'total_adulto_fd', 68, 'total_adulto_bd', 60,
    'total_joven_fi', 24, 'total_joven_bi', 20, 'total_joven_fd', 16, 'total_joven_bd', 14,
    'nivel_alerta_adulto', 9, 'nivel_alerta_joven', 11
  ),
  array['FI'],
  jsonb_build_object(
    'ev01', 1, 'ev02', 0, 'ev03', 0, 'ev04', 1, 'ev05', 0, 'ev06', 0, 'ev07', 0, 'ev08', 0,
    'ev09', 0, 'ev10', 1, 'ev11', 0, 'ev12', 0, 'ev13', 0, 'ev14', 0, 'ev15', 0, 'ev16', 0,
    'ev17', 0, 'ev18', 0, 'ev19', 0, 'ev20', 1, 'puntos_estres', 4
  ),
  false,
  'Ejemplo — perfil de pensamiento.pdf'
from evaluaciones e
join personas pe on pe.id = e.persona_id
join pedidos p on p.id = e.pedido_id
join empresas em on em.id = p.empresa_id
where em.slug = 'vega-materiales-ejemplo' and pe.nombre = 'Verónica Sandoval'
on conflict (evaluacion_id) do nothing;

insert into raven (evaluacion_id, raw, percentil, resultado, origen, duracion_segundos)
select e.id, 31, 90, 'Rango II · Superior al término medio', 'manual', 2280
from evaluaciones e
join personas pe on pe.id = e.persona_id
join pedidos p on p.id = e.pedido_id
join empresas em on em.id = p.empresa_id
where em.slug = 'vega-materiales-ejemplo' and pe.nombre = 'Verónica Sandoval'
on conflict (evaluacion_id) do nothing;

insert into analisis_discursivo (evaluacion_id, nivel, actual, futura, quien)
select e.id, 'Liderazgo 1',
  'En el relato ordena la producción por caminos alternativos: cuenta que ante una parada de línea evalúa reprogramar el turno, correr el mantenimiento o repartir la carga entre dos máquinas, y elige según lo que compromete la entrega de la semana. Sostiene el corto plazo sin perder de vista el objetivo del trimestre.',
  'Para conducir varios frentes a la vez necesita todavía apoyarse en un par para priorizar entre áreas que compiten por el mismo recurso. Con esa práctica, el paso al nivel siguiente es posible en un plazo de dos a tres años.',
  'Lorena Campos'
from evaluaciones e
join personas pe on pe.id = e.persona_id
join pedidos p on p.id = e.pedido_id
join empresas em on em.id = p.empresa_id
where em.slug = 'vega-materiales-ejemplo' and pe.nombre = 'Verónica Sandoval'
on conflict (evaluacion_id) do nothing;

commit;
