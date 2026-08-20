-- Migración del índice de cotizaciones que vivía en data/cotizaciones.json.
-- Se corre una vez; es idempotente por el token.

insert into public.cotizaciones (cliente, concepto, importe, version, estado, fecha, token, archivo, nota)
values
  ('Pla S.A.', 'Liderazgos Humanos · ciclo de cinco encuentros', 2625000, '1.0', 'Aprobada', date '2026-07-21', 'pla-liderazgos-ffa832', 'pla-liderazgos-ffa832.html', 'Cinco encuentros presenciales a ARS 525.000. Se dictan el 7 y el 11 de agosto.'),
  ('MyF Distribuciones', 'Diseño organizacional del área comercial', 6300000, '1.0', 'Enviada', date '2026-07-30', 'myf-comercial-1f7a93', 'myf-comercial-1f7a93.html', '50% al iniciar, 50% en la reunión de decisiones.'),
  ('Laruso SRL', 'Rediseño organizacional · cinco fases en once semanas', 3200000, '1.0', 'Lead', date '2026-08-18', 'laruso-rediseno-b99381', 'laruso-rediseno-b99381.html', 'Tres pagos: 1.280.000 al iniciar, 960.000 al cierre de la fase 2 y 960.000 al cierre. Factura C, validez hasta el 17/09/2026. Evaluaciones y formación se cotizan aparte.')
on conflict (token) do update set
  cliente = excluded.cliente, concepto = excluded.concepto, importe = excluded.importe,
  estado = excluded.estado, fecha = excluded.fecha, archivo = excluded.archivo, nota = excluded.nota;

-- Enganchar con las empresas que ya existen, por nombre normalizado.
update public.cotizaciones c set empresa_id = e.id from public.empresas e
where c.empresa_id is null
  and lower(regexp_replace(c.cliente, '\s+(SRL|S\.?A\.?|SAS)$', '', 'i')) = lower(e.nombre);
