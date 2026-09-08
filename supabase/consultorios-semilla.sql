-- Lo que hay hoy en el Centro: los cuatro espacios, su horario y la escala de
-- precios vigente desde el 1 de julio de 2026.
--
-- Va en un archivo aparte del esquema porque son datos y no estructura: si
-- mañana se abre un quinto espacio se carga desde la pantalla, no desde acá.
--
-- El SUM queda sin tarifa a propósito: el precio por hora está sin definir, y
-- la pantalla lo muestra como pendiente en vez de inventar un número.

insert into public.espacios (nombre, tipo, categoria, orden) values
  ('Consultorio 1', 'consultorio', 'A', 1),
  ('Consultorio 2', 'consultorio', 'B', 2),
  ('Consultorio 3', 'consultorio', 'A', 3),
  ('SUM',           'sum',         'SUM', 4)
on conflict (nombre) do nothing;

-- De lunes a viernes de 8 a 20, los cuatro espacios igual.
insert into public.apertura (espacio_id, dia_semana, desde_hora, hasta_hora)
select e.id, d.dia, time '08:00', time '20:00'
  from public.espacios e
 cross join generate_series(0, 4) as d(dia)
on conflict (espacio_id, dia_semana) do nothing;

-- La escala vigente. Categoría A son los consultorios 1 y 3; B es el 2.
insert into public.tarifas (categoria, horas_semana_desde, precio_hora, desde) values
  ('A',  1, 3440.00, date '2026-07-01'),
  ('A',  4, 2200.00, date '2026-07-01'),
  ('A',  8, 1995.00, date '2026-07-01'),
  ('A', 12, 1850.00, date '2026-07-01'),
  ('A', 16, 1730.00, date '2026-07-01'),
  ('A', 20, 1745.00, date '2026-07-01'),
  ('B',  1, 5020.00, date '2026-07-01'),
  ('B',  4, 3305.00, date '2026-07-01'),
  ('B',  8, 2920.00, date '2026-07-01'),
  ('B', 12, 2780.00, date '2026-07-01'),
  ('B', 16, 2600.00, date '2026-07-01'),
  ('B', 20, 2675.00, date '2026-07-01')
on conflict (categoria, horas_semana_desde, desde) do nothing;

-- Lo único del equipamiento que está escrito en el documento de convivencia.
-- El resto lo cargan ellas, que son las que saben qué hay en cada sala.
insert into public.espacio_incluye (espacio_id, texto, orden)
select e.id, 'Timbre independiente', 1
  from public.espacios e
 where e.tipo = 'consultorio'
   and not exists (
     select 1 from public.espacio_incluye i
      where i.espacio_id = e.id and i.texto = 'Timbre independiente'
   );
