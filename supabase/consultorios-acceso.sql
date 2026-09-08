-- El acceso del inquilino al sistema.
--
-- La contraseña se guarda como huella de scrypt, nunca en claro:
-- `scrypt$<sal>$<huella>`. Quien lee la base no puede entrar con lo que ve.
--
-- El alta y el restablecimiento van por un enlace de un solo uso, que las
-- propietarias generan desde el OS y mandan por WhatsApp: camposhr.com no tiene
-- correo saliente, y esperar a montarlo dejaba la pantalla del inquilino sin
-- puerta de entrada.

alter table public.inquilinos add column if not exists alta_token text unique;
alter table public.inquilinos add column if not exists alta_vence timestamptz;

comment on column public.inquilinos.alta_token is
  'Enlace de un solo uso para poner la contraseña. Se borra al usarse.';
comment on column public.inquilinos.hash is
  'Huella scrypt de la contraseña, en formato scrypt$sal$huella. Nula mientras no tenga acceso.';
