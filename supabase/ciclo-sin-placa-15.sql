-- Se saca la placa 15 ("Qué hace que una devolución funcione") y el deck pasa
-- a 30 placas: de la 15 en adelante se corren una, con sus hasta.

update public.actividades a
   set placa = v.placa,
       config = case when v.hasta is null then a.config - 'hasta'
                     else a.config || jsonb_build_object('hasta', v.hasta) end
  from public.ciclos c,
       (values
         ('cd-traduccion', 17, 18),
         ('cd-ensayo-1', 20, null),
         ('cd-ensayo-2', 21, null),
         ('cd-ensayo-3', 22, 23),
         ('cd-pregunta', 24, null),
         ('cd-monedas', 25, 26),
         ('cd-reparto', 28, 29),
         ('cd-nps', 30, null),
         ('cd-llevas', 30, null),
         ('cd-cambiarias', 30, null)
       ) as v(clave, placa, hasta)
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = v.clave;
