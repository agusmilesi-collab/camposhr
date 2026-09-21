-- "Corran las sillas", en las tres rondas del role play.
--
-- Lo pidió el cliente el 18/9. La sala es un rectángulo con sillas de plástico
-- en filas y sin mesas: el trío no existe hasta que las corren, y decirlo solo
-- en voz alta se pierde entre ochenta personas mirando su teléfono.
--
-- Va antes de los nombres en la pantalla: primero se mueve la sala y después
-- se busca a la gente. Al revés son ochenta personas paradas leyendo.

begin;

update public.actividades a
   set config = a.config || '{"juntarse": "Corran las sillas y armen una ronda de tres."}'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-ensayo-1';

update public.actividades a
   set config = a.config || '{"juntarse": "Se cambia de trío: corran las sillas otra vez."}'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave in ('cd-ensayo-2', 'cd-ensayo-3');

commit;
