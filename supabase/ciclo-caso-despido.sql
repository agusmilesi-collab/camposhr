-- El caso 2 del role play: un despido, y no un cierre de posición.
--
-- Estaba escrito como "la posición se cierra, no es por su desempeño", que es
-- una conversación más cómoda y no la que pidió el cliente. Un despido es un
-- despido: la decisión está tomada, tiene una causa que la persona conoce, y
-- no hay nada que negociar.
--
-- Lo que lo separa del caso 1: ahí la revisión todavía admite corrección, acá
-- se terminó el camino. Por eso la ficha nombra las conversaciones de
-- desarrollo anteriores: sin ellas el despido sería la sorpresa que el GPM
-- justamente viene a evitar.

begin;

update public.actividades a
   set config = a.config || '{
     "caso": {
       "titulo": "Un despido",
       "ficha": [
         ["A quién", "Alguien de tu equipo con cuatro años en la empresa."],
         ["Qué pasó", "Viene por debajo de lo acordado desde marzo. Lo hablaron en dos conversaciones de desarrollo, quedó por escrito en el GPM, y no cambió."],
         ["Decisión", "Se desvincula. Ya está firmado, termina el viernes, y no se negocia."]
       ],
       "paraQuienRecibe": "Llevás cuatro años acá. Sabés que venías flojo y que te lo dijeron, pero no esperabas esto. Tu jefe te pidió cinco minutos."
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

commit;
