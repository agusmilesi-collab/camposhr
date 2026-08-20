-- Distribuidora Andina — el cliente inventado, ahora en Supabase.
--
-- Es la empresa con la que se prueba el circuito completo sin tocar datos de
-- personas reales. Existía en Airtable con dos candidatas; acá se rehace
-- entera y más grande, con gente en las seis etapas, para poder ejercitar
-- cada pantalla del OS.
--
-- Todo lo de este archivo es inventado: los nombres, los teléfonos (prefijo
-- 555, que no existe) y los correos (dominio .invalid, reservado por norma
-- justamente para esto).
--
-- Es idempotente: se puede correr de nuevo y deja el mismo estado.

-- ------------------------------------------------------------------ empresa
insert into public.empresas (nombre, slug, activa)
values ('Distribuidora Andina', 'distribuidora-andina', true)
on conflict (slug) do update set nombre = excluded.nombre;

-- -------------------------------------------------------------- evaluadoras
insert into public.evaluadoras (nombre) values ('Lorena Campos'), ('Lucila Campos')
on conflict do nothing;

-- ----------------------------------------------------------------- baterías
insert into public.baterias (codigo, nombre, descripcion, precio, duracion_min, tests) values
  ('Batería 1', 'Batería 1', 'Rorschach y Raven.', 90000, 90,
   array['Rorschach','Raven']),
  ('Batería 2', 'Batería 2', 'Rorschach, Raven y Benziger.', 120000, 120,
   array['Rorschach','Raven','Benziger']),
  ('Batería 3', 'Batería 3', 'Rorschach, Raven, Benziger y cualitativos.', 150000, 150,
   array['Rorschach','Raven','Benziger','Bender','Gráfico de dos personas'])
on conflict (codigo) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      precio = excluded.precio,
      duracion_min = excluded.duracion_min,
      tests = excluded.tests;

-- ------------------------------------------------------------------ pedidos
with e as (select id from public.empresas where slug = 'distribuidora-andina')
insert into public.pedidos (empresa_id, bateria_id, puesto, familia, seniority, estado, fecha_pedido, notas)
select e.id, b.id, v.puesto, v.familia, v.seniority, v.estado, v.fecha, v.notas
from e
cross join (values
  ('Jefe de depósito',      'Operaciones', 'Jefatura',   'Abierto', date '2026-08-03', 'Reemplazo por renuncia. Turno mañana.',       'Batería 3'),
  ('Cajera de sucursal',    'Comercial',   'Operativo',  'Abierto', date '2026-08-10', 'Dos vacantes en la sucursal de Alberdi.',    'Batería 1'),
  ('Repositor de sucursal', 'Comercial',   'Operativo',  'Abierto', date '2026-08-12', 'Alta temporada. Se busca gente joven.',      'Batería 1'),
  ('Analista de compras',   'Administración','Semi senior','Abierto', date '2026-07-28','Puesto nuevo. Reporta a la gerencia.',      'Batería 2')
) as v(puesto, familia, seniority, estado, fecha, notas, bateria)
join public.baterias b on b.codigo = v.bateria
where not exists (
  select 1 from public.pedidos p where p.empresa_id = e.id and p.puesto = v.puesto
);

-- ----------------------------------------------------------------- personas
with e as (select id from public.empresas where slug = 'distribuidora-andina')
insert into public.personas (empresa_id, nombre, email, telefono)
select e.id, v.nombre, v.email, v.telefono
from e
cross join (values
  ('Malena Duarte',     'malena.duarte@ejemplo.invalid',    '+54 9 351 555 0110'),
  ('Rocío Villalba',    'rocio.villalba@ejemplo.invalid',   '+54 9 351 555 0111'),
  ('Nahuel Ibarra',     'nahuel.ibarra@ejemplo.invalid',    '+54 9 351 555 0112'),
  ('Camila Ferreyra',   null,                                '+54 9 351 555 0113'),
  ('Bruno Sandoval',    'bruno.sandoval@ejemplo.invalid',   '+54 9 351 555 0114'),
  ('Ariana Molina',     'ariana.molina@ejemplo.invalid',    '+54 9 351 555 0115'),
  ('Tomás Roldán',      'tomas.roldan@ejemplo.invalid',     null),
  ('Lucía Barrientos',  'lucia.barrientos@ejemplo.invalid', '+54 9 351 555 0117'),
  ('Emiliano Paz',      'emiliano.paz@ejemplo.invalid',     '+54 9 351 555 0118'),
  ('Victoria Alcaraz',  'victoria.alcaraz@ejemplo.invalid', '+54 9 351 555 0119'),
  ('Joaquín Medina',    'joaquin.medina@ejemplo.invalid',   '+54 9 351 555 0120'),
  ('Sofía Quiroga',     'sofia.quiroga@ejemplo.invalid',    '+54 9 351 555 0121')
) as v(nombre, email, telefono)
where not exists (
  select 1 from public.personas p where p.empresa_id = e.id and p.nombre = v.nombre
);

-- ------------------------------------------------------------- evaluaciones
-- Doce personas repartidas en las seis etapas: dos sin asignar, tres por
-- citar, dos por entrevistar, dos por analizar (una pasada de plazo), dos
-- entregadas y una en seguimiento.
with e as (select id from public.empresas where slug = 'distribuidora-andina')
insert into public.evaluaciones (
  persona_id, pedido_id, evaluadora_id, estado, mensaje, modalidad,
  fecha_ingreso, fecha_entrevista, fecha_entrega,
  bender_administrado, grafico_2_personas_administrado, recomendacion, facturado, pagado
)
select
  per.id, ped.id, ev.id, v.estado, v.mensaje, v.modalidad,
  v.ingreso, v.entrevista, v.entrega,
  v.bender, v.grafico, v.recomendacion, v.facturado, v.pagado
from e
cross join (values
  -- persona,            puesto,                 evaluadora,     estado,            mensaje,               modalidad,     ingreso,          entrevista,                        entrega,          bender, grafico, recomendación,             facturado, pagado
  ('Sofía Quiroga',      'Analista de compras',  null,           'Sin asignar',     null,                   null,          date '2026-08-17', null,                              null,             false, false, null,                        null,  null),
  ('Joaquín Medina',     'Repositor de sucursal',null,           'Sin asignar',     null,                   null,          date '2026-08-14', null,                              null,             false, false, null,                        null,  null),
  ('Malena Duarte',      'Cajera de sucursal',   'Lorena Campos','Por citar',       'Sin contactar',        null,          date '2026-08-11', null,                              null,             false, false, null,                        null,  null),
  ('Rocío Villalba',     'Repositor de sucursal','Lucila Campos','Por citar',       'Esperando respuesta',  'Online',      date '2026-08-10', null,                              null,             false, false, null,                        null,  null),
  ('Camila Ferreyra',    'Cajera de sucursal',   'Lorena Campos','Por citar',       'Sin contactar',        null,          date '2026-08-13', null,                              null,             false, false, null,                        null,  null),
  ('Nahuel Ibarra',      'Jefe de depósito',     'Lorena Campos','Por entrevistar', 'Esperando respuesta',  'Presencial',  date '2026-08-06', timestamptz '2026-08-20 09:30-03', null,             false, false, null,                        null,  null),
  ('Ariana Molina',      'Analista de compras',  'Lucila Campos','Por entrevistar', 'Esperando respuesta',  'Online',      date '2026-08-07', timestamptz '2026-08-21 15:00-03', null,             false, false, null,                        null,  null),
  ('Bruno Sandoval',     'Jefe de depósito',     'Lorena Campos','Por analizar',    'Esperando respuesta',  'Presencial',  date '2026-07-29', timestamptz '2026-08-08 10:00-03', null,             true,  true,  null,                        null,  null),
  ('Tomás Roldán',       'Repositor de sucursal','Lucila Campos','Por analizar',    'Esperando respuesta',  'Presencial',  date '2026-08-01', timestamptz '2026-08-17 11:00-03', null,             true,  false, null,                        null,  null),
  ('Lucía Barrientos',   'Cajera de sucursal',   'Lorena Campos','Entregado',       'Esperando respuesta',  'Presencial',  date '2026-07-20', timestamptz '2026-07-30 09:00-03', date '2026-08-04', true,  true,  'Apto',                      true,  false),
  ('Emiliano Paz',       'Analista de compras',  'Lucila Campos','Entregado',       'Esperando respuesta',  'Online',      date '2026-07-15', timestamptz '2026-07-24 16:30-03', date '2026-07-29', true, true, 'Apto con observaciones',    true,  true),
  ('Victoria Alcaraz',   'Jefe de depósito',     'Lorena Campos','Seguimiento',     'Esperando respuesta',  'Presencial',  date '2026-06-10', timestamptz '2026-06-18 10:00-03', date '2026-06-23', true, true, 'Apto',                      true,  true)
) as v(persona, puesto, evaluadora, estado, mensaje, modalidad, ingreso, entrevista, entrega, bender, grafico, recomendacion, facturado, pagado)
join public.personas per on per.nombre = v.persona and per.empresa_id = e.id
join public.pedidos ped on ped.puesto = v.puesto and ped.empresa_id = e.id
left join public.evaluadoras ev on ev.nombre = v.evaluadora
where not exists (
  select 1 from public.evaluaciones x where x.persona_id = per.id
);
