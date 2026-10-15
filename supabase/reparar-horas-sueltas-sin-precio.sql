-- Reparación puntual (15/10/2026). Desde el 8/9/2026 el alta de hora suelta
-- del OS buscaba el precio por la categoría de la sala y no por su id, así que
-- guardaba la reserva sin importe y no generaba el cargo del mes: esas horas
-- no aparecían para facturar. El código ya está corregido; esto pone el
-- importe que correspondía (misma regla que el sistema: escala vigente a la
-- fecha, tramo según las horas contratadas) y crea el cargo que faltó.
-- Solo toca reservas sin importe que no sean del SUM y no tengan cargo.
with res as (
  select r.id, r.inquilino_id, r.espacio_id, r.fecha, r.desde_hora, r.hasta_hora,
    extract(hour from r.hasta_hora) - extract(hour from r.desde_hora) as horas
  from reservas r join espacios e on e.id = r.espacio_id
  where r.importe is null and e.categoria <> 'SUM'
    and not exists (select 1 from movimientos m where m.reserva_id = r.id)
), tramo as (
  select res.*, greatest(res.horas, coalesce((
    select sum(extract(hour from c.hasta_hora) - extract(hour from c.desde_hora))
    from contratos c where c.inquilino_id = res.inquilino_id
      and c.vigente_desde <= res.fecha and (c.vigente_hasta is null or c.vigente_hasta >= res.fecha)), 0)) as tramo
  from res
), escala as (
  select t.*, (select max(x.desde) from tarifas x where x.desde <= t.fecha) as desde from tramo t
), precio as (
  select e.*, coalesce(
    (select ta.precio_hora from tarifas ta where ta.espacio_id = e.espacio_id and ta.desde = e.desde and ta.horas_semana_desde <= e.tramo order by ta.horas_semana_desde desc limit 1),
    (select ta.precio_hora from tarifas ta where ta.espacio_id = e.espacio_id and ta.desde = e.desde order by ta.horas_semana_desde asc limit 1)) as precio_hora
  from escala e
), calculado as (
  select p.id, p.inquilino_id, p.fecha, p.desde_hora, p.hasta_hora, s.nombre as sala, (p.precio_hora * p.horas)::numeric(12,2) as importe
  from precio p join espacios s on s.id = p.espacio_id
  where p.precio_hora is not null
), reservas_actualizadas as (
  update reservas r set importe = c.importe from calculado c where r.id = c.id
  returning r.id
)
insert into movimientos (inquilino_id, tipo, fecha, periodo, importe, reserva_id, detalle, quien)
select c.inquilino_id, 'cargo', c.fecha, date_trunc('month', c.fecha)::date, c.importe, c.id,
  c.sala || ', ' || to_char(c.desde_hora, 'HH24:MI') || ' a ' || to_char(c.hasta_hora, 'HH24:MI'),
  'Reparación 15/10/2026'
from calculado c;
