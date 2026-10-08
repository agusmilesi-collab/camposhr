-- El cliente recibe las facturas por su portal de proveedores (8/10/2026).
--
-- Hay clientes que no aceptan la factura por correo: hay que entrar a su
-- portal y cargarla a mano. A esos la factura no se les manda sola al pedir el
-- CAE; se descarga el PDF y se sube ahí.
alter table public.empresas add column if not exists portal_proveedores boolean not null default false;
notify pgrst, 'reload schema';
