-- La orden de compra que se mandó por correo: a quién, cuándo y con qué
-- identificador de Resend.
--
-- Son las mismas tres cosas que `facturas` ya guarda de su envío. El correo
-- sale igual sin estas columnas (ver `lib/correo-orden.ts`): lo que se pierde
-- es saber, desde el sistema, si una orden llegó a salir.

alter table public.ordenes_compra add column if not exists enviada_at timestamptz;
alter table public.ordenes_compra add column if not exists enviada_a  text[];
alter table public.ordenes_compra add column if not exists envio_id   text;
