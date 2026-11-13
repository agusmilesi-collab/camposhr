-- La cuenta a la que se transfiere el pago de cada factura: la de quien la
-- emite. Sale en el correo de la factura. Un CBU que empieza con 000 es un CVU
-- (billetera virtual) y el correo lo rotula así. Los datos de cada emisora se
-- cargan desde el editor SQL, no desde este archivo: el repositorio es público.
alter table emisores
  add column if not exists banco text,
  add column if not exists titular text,
  add column if not exists numero_cuenta text,
  add column if not exists cbu text,
  add column if not exists alias text;
