-- Las consignas, dichas en el idioma de John Deere.
--
-- Acordado el 18/9: el proceso de revisión anual se llama GPM y las del mes a
-- mes son conversaciones de desarrollo. Las consignas nombran la instancia
-- donde cada cosa pasa de verdad, y no "la evaluación" en abstracto.
--
-- Dónde entra cada bloque, que es la decisión de fondo:
--
--   El reconocimiento y la conversación difícil viven los dos en la
--   conversación de desarrollo. El GPM es la consecuencia: la calificación se
--   puede defender porque los hechos están anotados desde marzo.
--
--   La conversación difícil NO se ubica en el GPM a propósito. El cliente dijo
--   que las conversaciones de desarrollo existen para que nadie llegue al GPM
--   por sorpresa; enseñar a dar la mala noticia dentro de la calificación anual
--   sería enseñar justo lo que quieren evitar.

begin;

update public.actividades a
   set enunciado = 'El que diste en una conversación de desarrollo, o en el pasillo. Con las palabras que usaste. Nadie lo ve más que vos.'
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-reconocimiento';

update public.actividades a
   set enunciado = 'La que tenés que tener en la próxima conversación de desarrollo y venís postergando. Escribila como se la dirías. No pedimos con quién: ningún nombre entra acá.'
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-conversacion';

update public.actividades a
   set enunciado = 'Un hecho es algo que la otra persona puede ir a verificar, y es lo que sostiene la calificación del GPM cuando llegue.'
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-es-hecho';

commit;
