-- El responsable de compras es una categoría aparte de quien solicita.
--
-- `facturacion` vuelve a querer decir una sola cosa: es responsable de compras
-- y recibe las facturas y los recibos de pago de toda la empresa. Si la empresa
-- no tiene ninguno, van a quien solicitó el candidato, y eso lo resuelve el
-- código (`lib/correo-destinos.ts`), no una marca en cada solicitante.
--
-- `avisos-correo.sql` había tildado la factura a todos los que piden y había
-- guardado en `recibe_todo` quién la recibía antes. Acá se deshace: compras
-- son los que ya lo eran, y `recibe_todo` vuelve a hablar solo de los avisos.

update public.contactos set facturacion = recibe_todo, recibe_todo = false
where pide;
