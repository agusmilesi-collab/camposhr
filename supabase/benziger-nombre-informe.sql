-- Cómo se llamaba el informe que se subió.
--
-- El archivo se guarda con el identificador de la evaluación, que sirve para
-- encontrarlo y no para reconocerlo. Sin el nombre original, la pantalla solo
-- puede decir que hay algo cargado, y no si es el informe que corresponde.

alter table public.benziger
  add column if not exists pdf_nombre text;
