-- Mini encuesta de la charla 1. Va antes de "El momento exacto de mañana".
--
-- Ninguna pregunta juzga a quien responde: dos miran al equipo y al rol, una
-- pide lo que falta y otra describe las condiciones de trabajo. Con eso el
-- informe a Recursos Humanos habla de decisiones y no de virtudes personales.
update actividades set orden = 5 where clave = 'c1-momento';

insert into actividades (clave, charla, orden, tipo, titulo, enunciado, opciones, ciclo_id)
values
  ('c1-equipo', 1, 1, 'opcion',
   '¿Qué venís notando más seguido en tu equipo?',
   'Lo que más se repite en tu gente estas últimas semanas.',
   '["Cansancio","Desánimo","Tensión entre personas","Gente que se guarda lo que piensa","El equipo está bien"]'::jsonb,
   (select id from ciclos limit 1)),

  ('c1-esfuerzo', 1, 2, 'opcion',
   '¿Qué parte de tu rol te demanda más esfuerzo?',
   'La parte del trabajo que te deja más cansado, aunque la hagas bien.',
   '["La parte técnica","Coordinar con otras áreas","Conducir a las personas","Decidir sin tener toda la información"]'::jsonb,
   (select id from ciclos limit 1)),

  ('c1-ayuda', 1, 3, 'opcion',
   '¿Qué te ayudaría más a conducir mejor a tu equipo?',
   'Lo que más falta te hace hoy para conducir. Una sola.',
   '["Más tiempo","Criterios más claros de arriba","Respaldo de mi jefe","Herramientas para conversar","Formación"]'::jsonb,
   (select id from ciclos limit 1)),

  ('c1-foco', 1, 4, 'opcion',
   '¿Cuánto tiempo seguido lográs trabajar sin que te interrumpan?',
   'En un día común: cuánto durás sin que te corten.',
   '["Menos de quince minutos","Hasta media hora","Cerca de una hora","Más de una hora"]'::jsonb,
   (select id from ciclos limit 1));

select clave, orden, titulo from actividades where charla = 1 order by orden;
