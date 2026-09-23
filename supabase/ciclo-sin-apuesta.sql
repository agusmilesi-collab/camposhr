-- Se saca la apuesta ("¿lo que escribiste es un hecho?") de la charla de John
-- Deere, junto con su placa. El teléfono termina en la conversación como sale
-- y no pregunta nada más: sin la placa, la pregunta aparecía sin que nadie la
-- presentara. Borrar la actividad se lleva sus aportes (on delete cascade).
--
-- Las placas de la 11 en adelante se corren una: el deck pasa de 33 a 32.

begin;

delete from public.actividades a
 using public.ciclos c
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = 'cd-es-hecho';

-- La conversación queda sola: ya no es un grupo de dos.
update public.actividades a
   set grupo = null
  from public.ciclos c
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = 'cd-conversacion';

update public.actividades a
   set placa = v.placa
  from public.ciclos c,
       (values
         ('cd-traduccion', 19),
         ('cd-ensayo-1', 22),
         ('cd-ensayo-2', 23),
         ('cd-ensayo-3', 24),
         ('cd-pregunta', 26),
         ('cd-monedas', 27),
         ('cd-reparto', 30),
         ('cd-nps', 32),
         ('cd-llevas', 32),
         ('cd-cambiarias', 32)
       ) as v(clave, placa)
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = v.clave;

commit;
