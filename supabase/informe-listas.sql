-- Las listas del informe que la evaluadora puede tocar.
--
-- Cuatro secciones del informe salen de un cálculo: las recomendaciones al
-- líder directo y los tres grupos del análisis cualitativo (destacado, dentro
-- de lo esperado y a desarrollar). El motor las arma leyendo el sumario, y casi
-- siempre están bien, pero no siempre: hay un caso donde la frase suena dura,
-- otro donde falta algo que la evaluadora vio en la entrevista y no está en
-- ningún índice, y otro donde el orden no es el que ella quiere defender
-- delante del cliente.
--
-- Acá se guarda lo que ella dejó: la lista final, con su orden, sus textos
-- editados y lo que haya agregado.
--
--   {"recomendaciones": ["…", "…"], "destacadas": [], "esperadas": [],
--    "desarrollar": ["…"]}
--
-- **Una clave que no está significa "usá lo calculado".** No es lo mismo que
-- una lista vacía, que significa "esta sección va sin ítems". Por eso el valor
-- por defecto es un objeto vacío y no las cuatro claves en null: mientras nadie
-- toque nada, el informe es el que arma el motor, y volver a lo calculado es
-- borrar esa clave.
--
-- El texto editado no se recalcula. Si después cambia la codificación, lo que
-- ella escribió sigue como está: es su lectura, no un derivado del sumario. La
-- pantalla avisa cuándo una sección está intervenida.
alter table public.evaluaciones
  add column if not exists informe_listas jsonb not null default '{}'::jsonb;

comment on column public.evaluaciones.informe_listas is
  'Las listas del informe que tocó la evaluadora. Clave ausente = usar lo calculado.';
