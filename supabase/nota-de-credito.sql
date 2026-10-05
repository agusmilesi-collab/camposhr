-- La nota de crédito: cómo se anula una factura que ARCA ya autorizó.
--
-- Una factura con CAE no se borra: existe en ARCA. Se anula emitiendo una
-- nota de crédito C (tipo 13) por el mismo importe, asociada a esa factura.
--
-- La nota es una fila más de `facturas`, con `cbte_tipo` 13 y `anula_id`
-- apuntando a la factura que anula. La numeración es propia: el índice único
-- ya separa por tipo de comprobante.
alter table public.facturas add column if not exists anula_id uuid references public.facturas (id);
create unique index if not exists facturas_anula_id_key
  on public.facturas (anula_id) where anula_id is not null;

-- A quién cubría un renglón de una factura anulada.
--
-- Una evaluación entra en una sola factura (`factura_items_evaluacion_idx`).
-- Al anular, esas personas tienen que poder facturarse de nuevo, así que el
-- renglón las suelta; pero el dato de a quién cubría no se tira: pasa a esta
-- columna, que no tiene índice único.
--
-- **Va sin clave foránea, a propósito.** Con una segunda clave de
-- `factura_items` hacia `evaluaciones`, la API de datos ya no sabe por cuál
-- de las dos unir cuando una consulta pide "los renglones con su evaluación",
-- y contesta 300 a todas: se cayeron Facturación y Costos enteras hasta que se
-- sacó (5/10/2026). Es un dato de archivo; no hace falta que la base lo cuide.
alter table public.factura_items add column if not exists evaluacion_anulada_id uuid;
alter table public.factura_items drop constraint if exists factura_items_evaluacion_anulada_id_fkey;

notify pgrst, 'reload schema';
