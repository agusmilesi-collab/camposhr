-- El protocolo inventado del candidato entregado del portal de ejemplo.
--
-- Veintidós respuestas escritas a mano para que el informe de la muestra tenga
-- de dónde salir. No sale de ninguna persona real: los códigos se eligieron
-- para dar un protocolo que se pueda interpretar (R alto, Lambda por debajo de
-- uno) y un perfil coherente con el puesto que se está mostrando.
--
-- Del sumario se encarga el motor: se calcula con el botón de la ficha, igual
-- que en cualquier evaluación.

begin;

delete from rorschach_respuestas
where evaluacion_id in (
  select e.id from evaluaciones e
  join pedidos p on p.id = e.pedido_id
  join empresas em on em.id = p.empresa_id
  where em.slug = 'vega-materiales-ejemplo'
);

insert into rorschach_respuestas
  (evaluacion_id, test, lamina, n_respuesta, localizacion, n_localizacion,
   determinantes, fq, par, contenidos, popular, z, cc_ee, agc, sl, origen)
select e.id, 'Rorschach', x.lam, x.n, x.loc, x.nloc,
       x.det, x.fq, x.par, x.cont, x.pop, x.z, x.ccee, x.agc, x.sl, 'manual'
from evaluaciones e
join personas pe on pe.id = e.persona_id
join pedidos p on p.id = e.pedido_id
join empresas em on em.id = p.empresa_id,
(values
  ('I',   1, 'Wo',  '1', array['F'],           'O', false, array['A'],       true,  1.0::numeric, array[]::text[], false, false),
  ('I',   2, 'W+',  '1', array['Ma'],          'O', true,  array['H','Cg'],  false, 4.0, array['COP'], false, false),
  ('II',  3, 'D+',  '6', array['FMa','CF'],    'O', true,  array['A'],       true,  3.0, array['COP'], false, false),
  ('II',  4, 'DS+', '5', array['ma'],          'U', false, array['Ex'],      false, 4.5, array[]::text[], false, false),
  ('III', 5, 'D+',  '1', array['Ma'],          'O', true,  array['H','Hh'],  true,  3.0, array['COP'], false, false),
  ('III', 6, 'Do',  '3', array['FC'],          'O', false, array['Cg'],      false, null, array[]::text[], false, false),
  ('IV',  7, 'Wo',  '1', array['FT'],          'O', false, array['A','Ad'],  false, 2.0, array[]::text[], true,  false),
  ('IV',  8, 'Do',  '3', array['F'],           'O', false, array['Bt'],      false, null, array[]::text[], false, false),
  ('V',   9, 'Wo',  '1', array['F'],           'O', false, array['A'],       true,  1.0, array[]::text[], false, false),
  ('V',  10, 'Do',  '4', array['F'],           'U', false, array['Ad'],      false, null, array[]::text[], false, false),
  ('VI', 11, 'Wo',  '1', array['FY'],          'O', false, array['A'],       true,  2.5, array[]::text[], false, false),
  ('VI', 12, 'Do',  '3', array['F'],           'O', false, array['Hh'],      false, null, array[]::text[], false, false),
  ('VII',13, 'W+',  '1', array['Mp'],          'O', true,  array['H'],       true,  2.5, array[]::text[], false, false),
  ('VII',14, 'Do',  '2', array['F'],           'U', false, array['Ad'],      false, null, array[]::text[], false, false),
  ('VIII',15,'Wo',  '1', array['FC'],          'O', false, array['A','Bt'],  true,  4.5, array[]::text[], false, false),
  ('VIII',16,'Do',  '4', array['CF'],          'U', false, array['Bt'],      false, null, array[]::text[], false, false),
  ('IX', 17, 'W+',  '1', array['Ma','FC'],     'O', true,  array['H','Art'], false, 5.5, array[]::text[], false, false),
  ('IX', 18, 'Do',  '3', array['F'],           '-', false, array['An'],      false, null, array['MOR'], false, false),
  ('X',  19, 'D+',  '1', array['FMa'],         'O', true,  array['A'],       true,  4.0, array['AG'], true, false),
  ('X',  20, 'Do',  '9', array['FC'],          'O', false, array['A'],       false, null, array[]::text[], false, false),
  ('X',  21, 'Do',  '11', array['F'],         '-', false, array['Ad'],      false, null, array[]::text[], false, false),
  ('X',  22, 'Wv',  '1', array['C'''],          'U', false, array['Na'],      false, null, array[]::text[], false, false)
) as x(lam, n, loc, nloc, det, fq, par, cont, pop, z, ccee, agc, sl)
where em.slug = 'vega-materiales-ejemplo' and pe.nombre = 'Verónica Sandoval';

commit;
