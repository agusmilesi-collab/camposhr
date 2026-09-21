-- El reparto de las preguntas que quedaron sin contestar, al cerrar la charla.
--
-- Las tres más votadas se contestan en la sala. Las otras se reparten: cada
-- persona con años en el rol se lleva una, y siempre de un área distinta a la
-- de quien la escribió. Así el que recién empieza sale con un referente de otro
-- sector, que es justo donde nunca hubiese preguntado solo, y la empresa no
-- tiene que montar un programa de mentoría para que eso pase.
--
-- Va después de la votación y antes del cierre. No se responde desde el
-- teléfono: la pantalla dice cuál le tocó y se resuelve hablando.

begin;

insert into public.actividades
  (ciclo_id, clave, charla, orden, tipo, titulo, enunciado, opciones, titulo_control, config)
select c.id, 'cd-reparto', 1, 11, 'reparto',
       'Una pregunta para contestar',
       null,
       '[]'::jsonb,
       'Preguntas · repartir las que quedaron',
       '{
          "desde": "cd-pregunta",
          "de_quienes": {"campo": "rol", "valor": "Menos de un año"},
          "a_quienes": {"campo": "rol", "valor": "Más de un año"}
        }'::jsonb
  from public.ciclos c
 where c.nombre = 'Conversaciones difíciles'
on conflict (ciclo_id, clave) do update
  set tipo = excluded.tipo,
      titulo = excluded.titulo,
      orden = excluded.orden,
      titulo_control = excluded.titulo_control,
      config = excluded.config;

commit;
