-- Qué se hizo con el pedido, en palabras de quien lo resolvió. Null mientras
-- nadie contestó.
alter table public.tickets add column if not exists respuesta text;
