-- Cuándo la persona se dio de baja del proceso de selección (5/10/2026).
--
-- Es una marca y no una etapa: la etapa dice hasta dónde llegó la evaluación
-- (puede darse de baja antes de la entrevista o con la entrevista tomada), y
-- eso se conserva. Con fecha, la evaluación sale de los tableros, el portal la
-- muestra como "Baja", no se factura y no deja el pedido abierto.
--
-- Null es que sigue en el proceso. Volver atrás es borrar la fecha.

alter table public.evaluaciones
  add column if not exists baja_el date;

notify pgrst, 'reload schema';
