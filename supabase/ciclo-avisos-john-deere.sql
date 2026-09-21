-- Qué dice cada consigna sobre lo que se escribe.
--
-- El aviso de siempre ("se proyecta sin tu nombre") vale para el ciclo de Pla,
-- donde todo lo escrito termina en pantalla. Acá no: el reconocimiento y la
-- conversación no se proyectan nunca, y decir lo contrario debajo del campo
-- contradice al enunciado que está dos líneas más arriba.

begin;

update public.actividades a
   set config = a.config || '{"aviso": ""}'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-reconocimiento';

update public.actividades a
   set config = a.config || '{"aviso": "No se proyecta. Lo único que se muestra es cuántos de la sala escribieron un hecho."}'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-conversacion';

update public.actividades a
   set config = a.config || '{"aviso": "Se proyecta sin tu nombre, y la sala vota cuáles se contestan."}'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-pregunta';

commit;
