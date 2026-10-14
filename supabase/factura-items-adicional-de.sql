-- De quién es el renglón del adicional.
--
-- El adicional Benziger va en su propio renglón, sin `evaluacion_id`: el
-- índice único por evaluación es para que una persona no se facture dos veces,
-- y el adicional es un segundo renglón de alguien que ya está en la factura
-- (o, en la factura en dólares, de alguien que está en la factura en pesos).
-- Sin ninguna referencia, "Cubre" no sabía de quién era ese renglón y la
-- factura en dólares decía "adicional" en vez de listar a los candidatos.
--
-- Va sin clave foránea a propósito: una segunda clave de `factura_items` a
-- `evaluaciones` deja ambiguos los embeds de PostgREST y la API contesta 300 a
-- todo lo que une esas dos tablas. Se resuelve en código.

alter table public.factura_items add column if not exists adicional_de uuid;

comment on column public.factura_items.adicional_de is
  'La evaluación de la que este renglón es el adicional (Benziger). Sin FK a propósito.';

notify pgrst, 'reload schema';
