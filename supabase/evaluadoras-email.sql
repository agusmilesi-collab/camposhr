-- El correo de cada evaluadora.
--
-- Es a donde cae la respuesta del cliente cuando contesta un correo del
-- sistema: la orden de compra responde a la evaluadora del candidato y la
-- factura a la que la emitió. El dominio no recibe correo, así que sin esto
-- una respuesta se pierde.
--
-- Las direcciones se cargan en la base y no en este archivo: el repositorio
-- es público.

alter table public.evaluadoras add column if not exists email text;
