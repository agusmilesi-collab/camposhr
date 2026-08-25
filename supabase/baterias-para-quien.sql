-- Para quién se recomienda cada batería, editable (25/8/2026).
--
-- Estaba en dos lugares: adentro de `descripcion`, mezclado con lo que la
-- batería incluye, y otra vez en `lib/baterias.ts`, que es la copia fija que
-- ve el cliente en el portal. Dos textos para lo mismo, y solo uno se podía
-- corregir.
--
-- Ahora son dos columnas separadas porque son dos preguntas distintas, y son
-- las dos que se editan desde Configuración: qué incluye y para quién es.

alter table public.baterias add column if not exists para_quien text;

update public.baterias set
  descripcion = 'Evaluación psicotécnica con test proyectivo abreviado (Zulliger) más tests cognitivos y de estilo de pensamiento.',
  para_quien = 'Puestos operativos y mandos medios.'
where codigo = 'Batería 1';

update public.baterias set
  descripcion = 'Evaluación psicotécnica con test proyectivo completo (Rorschach, Sistema Comprehensivo de Exner) más tests cognitivos y de estilo de pensamiento.',
  para_quien = 'Perfiles profesionales y mandos medios calificados.'
where codigo = 'Batería 2';

update public.baterias set
  descripcion = 'Todo lo de la estándar más análisis discursivo según el modelo de Elliot Jaques, sobre cinco minutos de discurso del candidato.',
  para_quien = 'Jefaturas, gerencias y puestos de decisión.'
where codigo = 'Batería 3';
