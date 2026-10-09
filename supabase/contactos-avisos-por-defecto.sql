-- Qué recibe por correo un contacto mientras no lo eligió él.
--
-- Por defecto (Agustín, 9/10/2026): la orden de compra y la factura. La fecha
-- de entrevista, el informe y el recibo de pago van apagados hasta que la
-- persona los prenda en el portal.
--
-- `avisos_elegidos_at` dice cuándo eligió: lo sella el portal al guardar una
-- casilla. Quien ya eligió conserva lo suyo; a los demás se les pone el
-- defecto, una vez, y los contactos nuevos nacen así.

alter table public.contactos add column if not exists avisos_elegidos_at timestamptz;

update public.contactos set
  recibe_orden      = true,
  recibe_factura    = true,
  recibe_entrevista = false,
  recibe_informe    = false,
  recibe_recibo     = false
where avisos_elegidos_at is null;

alter table public.contactos alter column recibe_orden      set default true;
alter table public.contactos alter column recibe_factura    set default true;
alter table public.contactos alter column recibe_entrevista set default false;
alter table public.contactos alter column recibe_informe    set default false;
alter table public.contactos alter column recibe_recibo     set default false;
