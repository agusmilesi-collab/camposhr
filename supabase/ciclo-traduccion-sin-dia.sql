-- La traducción de la conversación (actividad 4 del panel) deja de preguntar
-- "¿Qué día se lo decís?". Quedan cinco campos: qué hizo, qué día pasó,
-- cuántas veces, qué le vas a pedir y para cuándo.

update public.actividades a
   set config = jsonb_set(
         a.config,
         '{campos}',
         (select coalesce(jsonb_agg(c), '[]'::jsonb)
            from jsonb_array_elements(a.config->'campos') c
           where c->>'clave' <> 'cuando_se_lo_decis')
       )
  from public.ciclos c
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = 'cd-traduccion';

-- Y sin la frase de cierre del reconocimiento ("¿sabrías qué hiciste bien y
-- cómo volver a hacerlo?"): en la conversación difícil no se reconoce nada.
update public.actividades a
   set config = a.config || '{"prueba": ""}'::jsonb
  from public.ciclos c
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = 'cd-traduccion';
