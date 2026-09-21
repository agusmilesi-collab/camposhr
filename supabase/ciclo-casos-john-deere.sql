-- Los tres casos del role play de John Deere, y la reacción de cada ronda.
--
-- Los dio el cliente en la reunión del 18 de septiembre y reemplazan a los tres
-- del ciclo de Pla, que estaban escritos para una planta de acoplados de 34
-- personas. Viven en la actividad y no en el código: la ficha se corrige hasta
-- el día anterior sin un despliegue.
--
-- Cada ficha son datos sueltos y nunca una frase armada: armar cómo decirlo es
-- el ejercicio. Quien recibe no ve la decisión, y su reacción le llega sola.

begin;

update public.actividades a
   set config = a.config || '{
     "caso": {
       "titulo": "Una revisión comportamental",
       "ficha": [
         ["A quién", "Alguien de tu equipo que cumple todos sus objetivos de negocio."],
         ["Qué pasó", "En los objetivos de valores viene flojo: dos personas del equipo pidieron no trabajar con él, y en la última reunión cortó tres veces a una compañera."],
         ["Decisión", "Queda registrado en el GPM y se revisa en la conversación de desarrollo del mes que viene."]
       ],
       "paraQuienRecibe": "Sos de los que más entrega del equipo y lo sabés. Tu jefe te pidió cinco minutos."
     },
     "reaccion": {
       "nombre": "Te defendés con los números",
       "instruccion": "Te parece injusto: cumplís todo lo que te piden y nadie te avisó nada antes.",
       "guion": [
         "Apenas te dice el motivo, contestá: \"Soy el que más cierra del equipo. ¿Eso no cuenta?\".",
         "Si te da un ejemplo, pedile otro: \"¿Y quién dijo eso? Porque conmigo nadie habló\".",
         "Cerrá con: \"Esto nunca me lo dijiste en todo el año\"."
       ]
     }
   }'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-ensayo-1';

update public.actividades a
   set config = a.config || '{
     "caso": {
       "titulo": "Una desvinculación",
       "ficha": [
         ["A quién", "Alguien de tu equipo con cuatro años en la empresa."],
         ["Qué pasó", "La posición se cierra. No es por su desempeño y no hay nada que pueda hacer para revertirlo."],
         ["Decisión", "Termina el viernes. Ya está firmado y no se negocia."]
       ],
       "paraQuienRecibe": "Llevás cuatro años acá y venías tranquilo. Tu jefe te pidió cinco minutos."
     },
     "reaccion": {
       "nombre": "Te quebrás",
       "instruccion": "Se te llenan los ojos de lágrimas y te cuesta hablar.",
       "guion": [
         "Cuando entendés lo que te está diciendo, quedate callado y mirá para abajo tres o cuatro segundos.",
         "Después hablá en voz baja y cortada: \"Perdón… dame un segundo\".",
         "Si te sigue dando explicaciones, tapate la cara con una mano y decí: \"Tengo dos chicos\"."
       ]
     }
   }'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-ensayo-2';

update public.actividades a
   set config = a.config || '{
     "caso": {
       "titulo": "Un cambio de la compañía",
       "ficha": [
         ["A quién", "Alguien de tu equipo que venía armando el proyecto hace cuatro meses."],
         ["Qué pasó", "Se congelaron las contrataciones externas. El equipo que se iba a abrir no se abre y hay que reorganizarse adentro."],
         ["Decisión", "El proyecto se suspende y esa persona vuelve a su tarea anterior. La decisión no la tomaste vos y no tenés fecha de revisión."]
       ],
       "paraQuienRecibe": "Hace cuatro meses que venís armando el proyecto. Tu jefe te pidió cinco minutos."
     },
     "reaccion": {
       "nombre": "No decís nada",
       "instruccion": "Contestás lo mínimo y querés terminar la conversación.",
       "guion": [
         "Cuando te dice que el proyecto no va, quedate callado, aunque el silencio se haga largo.",
         "Si te pregunta algo, contestá \"ajá\" o \"está bien\", y nada más.",
         "Quedate quieto, mirando la puerta. Si insiste, decí: \"¿Puedo volver a lo mío?\"."
       ]
     }
   }'::jsonb
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-ensayo-3';

commit;
