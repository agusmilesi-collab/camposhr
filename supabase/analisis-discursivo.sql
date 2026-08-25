-- El análisis discursivo, que hasta ahora se tomaba y no se guardaba (25/8/2026).
--
-- Está en la batería 3 desde siempre y salía en el informe escrito a mano: la
-- pirámide con el nivel marcado y los dos párrafos de capacidad potencial. En
-- el OS no había dónde cargarlo, así que la batería más cara era la única que
-- no se podía terminar desde acá.
--
-- Una fila por evaluación, como el Raven y el Benziger. El nivel no se calcula:
-- lo ubica la evaluadora, que es quien escuchó a la persona.

create table if not exists public.analisis_discursivo (
  evaluacion_id uuid primary key references public.evaluaciones(id) on delete cascade,
  -- Uno de los cuatro escalones de la pirámide. Null mientras no se eligió.
  nivel text,
  -- Los dos párrafos del informe. Los escribe la evaluadora.
  actual text,
  futura text,
  quien text,
  actualizado_at timestamptz not null default now()
);

comment on table public.analisis_discursivo is
  'Análisis discursivo (modelo de Elliot Jaques). El nivel lo ubica la evaluadora, no se calcula.';
