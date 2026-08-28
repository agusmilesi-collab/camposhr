-- Dos escalas del perfil del puesto que no se excluían ni cubrían todo.
--
-- "Pocas personas" y "Equipo reducido" eran lo mismo dicho de dos maneras: un
-- equipo reducido es pocas personas, así que quien contestaba tenía que elegir
-- entre dos opciones idénticas. Ahora el eje es con cuánta gente se trabaja:
-- solo, con un equipo fijo, o con mucha gente distinta.
--
-- Y entre "Una vez al día" y "Una vez por semana o menos" quedaba afuera quien
-- ve a su jefe tres veces por semana. Ahora los tres tramos se tocan.
--
-- Hay un pedido contestado con cada una de las etiquetas viejas y se traducen a
-- la nueva que le corresponde: dejarlas sin traducir haría que la ficha
-- mostrara la pregunta sin respuesta.
update pedidos set puesto_interaccion = 'Mucha gente distinta'
where puesto_interaccion = 'Muchas personas';

update pedidos set puesto_interaccion = 'Un equipo fijo'
where puesto_interaccion = 'Equipo reducido';

update pedidos set puesto_interaccion = 'Solo o casi solo'
where puesto_interaccion = 'Pocas personas';

update pedidos set puesto_contacto_jefe = 'Casi todos los días'
where puesto_contacto_jefe = 'Una vez al día';

update pedidos set puesto_contacto_jefe = 'Una o dos veces por semana'
where puesto_contacto_jefe = 'Una vez por semana o menos';
