-- Cuántas personas le reportan a quien ocupe el puesto.
--
-- Es la única competencia del informe que no tenía ninguna pregunta del pedido
-- que dijera cuánto la pide el puesto: Liderazgo. Las otras cinco salen de las
-- escalas que ya están (tipo de problemas, presión, interacción, contacto con
-- el jefe, espacio para innovar). Se guarda desde el arranque para que el
-- ajuste entre la persona y el puesto tenga el dato cuando se calcule.
--
-- Texto libre como las demás escalas: la lista de opciones vive en
-- `lib/pedido-campos.ts`.
alter table public.pedidos
  add column if not exists puesto_a_cargo text;

comment on column public.pedidos.puesto_a_cargo is
  'Personas a cargo del puesto: Nadie, De 1 a 5 personas, 6 o más personas.';

notify pgrst, 'reload schema';
