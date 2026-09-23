-- Se saca la placa 11 ("Conducir un equipo puede ser un espacio solitario") y
-- el deck pasa a 31 placas: de la 11 en adelante se corren una.
--
-- Además, cada actividad guarda hasta qué placa queda abierta (config.hasta),
-- para que el panel muestre las dos puntas: "Placas 9 a 11". Sin eso la
-- tarjeta decía solo dónde se abre, y el aviso de cierre de la placa parecía
-- contradecirla. Las que se cierran solas al abrir la siguiente no lo llevan.

update public.actividades a
   set placa = v.placa,
       config = case when v.hasta is null then a.config - 'hasta'
                     else a.config || jsonb_build_object('hasta', v.hasta) end
  from public.ciclos c,
       (values
         ('cd-reconocimiento', 4, 5),
         ('cd-reconocimiento-traducido', 8, null),
         ('cd-conversacion', 9, 11),
         ('cd-traduccion', 18, 19),
         ('cd-ensayo-1', 21, null),
         ('cd-ensayo-2', 22, null),
         ('cd-ensayo-3', 23, 24),
         ('cd-pregunta', 25, null),
         ('cd-monedas', 26, 27),
         ('cd-reparto', 29, 30),
         ('cd-nps', 31, null),
         ('cd-llevas', 31, null),
         ('cd-cambiarias', 31, null)
       ) as v(clave, placa, hasta)
 where c.id = a.ciclo_id
   and c.nombre = 'Conversaciones difíciles'
   and a.clave = v.clave;
