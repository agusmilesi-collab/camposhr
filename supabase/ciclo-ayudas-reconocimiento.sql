-- Las ayudas de los campos del reconocimiento traducido.
--
-- "Un verbo y un objeto" no alcanza: deja pasar "redactó muy bien el informe",
-- que es el mismo elogio de antes con otra forma. El adjetivo se cuela en el
-- campo del hecho, que es justo lo que el ejercicio viene a sacar.
--
-- La ayuda lo dice con el ejemplo adentro, porque en este momento de la charla
-- la sala vio la traducción del "sos un crack" y todavía no escuchó la teoría
-- de hecho contra interpretación: el ejemplo hace el trabajo que ahí todavía no
-- hace el concepto.
--
-- Dónde vive el valor: el adjetivo sobra porque el tercer campo ya lo dice
-- mejor. "Redactó el informe" (lo que hizo) más "con eso cerramos el pedido a
-- tiempo" (lo que se consiguió) es un reconocimiento que la persona puede
-- repetir. "Lo hizo bien" no le dice qué repetir.

begin;

update public.actividades a
   set config = jsonb_set(
     a.config,
     '{campos}',
     '[
       {"clave": "que_hizo", "etiqueta": "¿Qué hizo?",
        "ayuda": "Lo que hizo, sin calificarlo. \"Redactó el informe\", no \"lo redactó bien\"."},
       {"clave": "cuando", "etiqueta": "¿Cuándo?",
        "ayuda": "Un día, o una semana."},
       {"clave": "para_que", "etiqueta": "¿Qué se consiguió gracias a eso?",
        "ayuda": "El efecto. Acá sí entra por qué estuvo bueno."}
     ]'::jsonb
   )
 from public.ciclos c
where c.id = a.ciclo_id and c.nombre = 'Conversaciones difíciles'
  and a.clave = 'cd-reconocimiento-traducido';

commit;
