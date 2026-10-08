-- Quien solicita elige en el portal si recibe la factura de sus candidatos y
-- el recibo de pago, cada uno por separado.
--
-- Null es "no eligió": vale la regla de siempre, los recibe si su empresa no
-- tiene responsable de compras. Verdadero o falso es lo que eligió la persona.
-- Por eso las columnas no tienen valor por defecto.

alter table public.contactos add column if not exists recibe_factura boolean;
alter table public.contactos add column if not exists recibe_recibo  boolean;
