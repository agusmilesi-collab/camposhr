-- La ciudad para la que se evalúa a cada candidato (8/10/2026).
--
-- Federada Salud pide el mismo puesto para varias ciudades: un cardiólogo para
-- Bariloche y otro para Mendoza entran al mismo pedido "Cardiólogo". La ciudad
-- es de cada candidato y se muestra al lado del puesto ("Cardiólogo
-- Bariloche"); el pedido no cambia. El campo aparece en el portal solo para
-- las empresas con empresas.pedido_con_ciudad.

alter table public.evaluaciones
  add column if not exists ciudad text;

notify pgrst, 'reload schema';
