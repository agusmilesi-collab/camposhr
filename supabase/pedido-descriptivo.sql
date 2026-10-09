-- El descriptivo de puesto que el cliente adjunta al pedido desde su portal.
--
-- Es el documento que la empresa ya tiene escrito sobre el puesto (un PDF, un
-- Word, lo que usen). Es opcional: quien no lo tiene carga el pedido igual. El
-- archivo va al bucket privado, en `descriptivos/<pedido>.<ext>`, y acá queda
-- dónde está y cómo se llamaba cuando lo subieron, que es lo que reconoce
-- quien lo busca.
alter table public.pedidos
  add column if not exists descriptivo_path text,
  add column if not exists descriptivo_nombre text;

notify pgrst, 'reload schema';
