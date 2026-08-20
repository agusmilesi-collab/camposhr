-- El fundamento de la recomendación, escrito por la evaluadora.
--
-- La conclusión sola dice "Apto" o "No apto" y no dice por qué. El fundamento
-- es lo que después permite releer una decisión meses más tarde, y lo que el
-- seguimiento contrasta cuando la persona ya entró a trabajar.
--
-- Va en la evaluación y no en el informe: el informe es lo que se le manda al
-- cliente, y esto es lo que la evaluadora anota para adentro.

alter table public.evaluaciones
  add column if not exists recomendacion_notas text;
