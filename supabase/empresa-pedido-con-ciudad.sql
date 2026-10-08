-- Clientes que piden la misma búsqueda en varias ciudades (8/10/2026).
--
-- Federada Salud evalúa perfiles de salud para las ciudades donde da
-- servicio: un cardiólogo para Bariloche y otro para Mendoza son dos
-- búsquedas. Con la marca prendida, el formulario de pedido del portal suma un
-- campo Ciudad al lado del puesto, y la ciudad se agrega al nombre del pedido
-- ("Cardiólogo Bariloche"). No cambia nada más.

alter table public.empresas
  add column if not exists pedido_con_ciudad boolean not null default false;

update public.empresas set pedido_con_ciudad = true where nombre = 'Federada Salud';

notify pgrst, 'reload schema';
