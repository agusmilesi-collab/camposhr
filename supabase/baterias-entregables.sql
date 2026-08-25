-- Los entregables pasan a ser las secciones del informe, con el nombre que
-- llevan ahí (25/8/2026).
--
-- "Informe psicotécnico ejecutivo" se va porque es el documento entero, y lo
-- que se elige es qué trae adentro. "Sumario estructural Exner" se va porque no
-- se entrega: son los índices crudos del protocolo, que se leen en la ficha y
-- nunca estuvieron en el documento del cliente.
--
-- "Recomendaciones de incorporación" pasa a "Recomendaciones para su líder",
-- que es el título de la sección 04, y se suma "Recomendación de incorporación",
-- que es el nivel de ajuste de la sección 01: el go o no go, que se entregaba
-- sin estar declarado.
--
-- El informe de potencial va solo donde hay análisis discursivo.

update public.baterias
set outputs = (
  select array_agg(x order by orden)
  from (
    select 'Recomendación de incorporación' as x, 1 as orden
    union all select 'Mapa de competencias', 2
    union all select 'Recomendaciones para su líder', 3
    union all
      select 'Informe de potencial', 4
      where 'Análisis discursivo (Elliot Jaques)' = any(tests)
  ) s
);
