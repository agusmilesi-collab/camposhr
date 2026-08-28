-- Qué incluye cada batería, dicho para quien contrata.
--
-- Es el texto que el cliente lee en su portal al elegir batería para un pedido
-- nuevo (`lib/baterias-portal.ts` → `queIncluye`), y estaba escrito en
-- vocabulario clínico: "test proyectivo abreviado", "Sistema Comprehensivo de
-- Exner", "el modelo de Elliot Jaques". Quien contrata es de Recursos Humanos y
-- ninguna de las tres cosas le dice qué va a saber de la persona.
--
-- Queda con el mismo registro de camposhr.com/psicotecnicos: qué se le toma en
-- palabras corrientes, y qué se puede afirmar con eso. Se edita desde Sistema →
-- Configuración → Baterías, así que esto es el punto de partida y no una
-- decisión cerrada.
--
-- El nombre interno no se toca: "Batería básica con Zulliger" nombra el test
-- que se administra y es lo que la evaluadora necesita ver al cargar un pedido.

update baterias set descripcion =
  'Test de manchas en versión corta, prueba gráfica, test cognitivo y entrevista por competencias. Alcanza para leer cómo organiza el trabajo, cuánta presión aguanta y cómo se lleva con el equipo.'
where codigo = 'Batería 1';

update baterias set descripcion =
  'Test de manchas completo, de diez láminas, más prueba gráfica, test cognitivo y entrevista por competencias. La persona da muchas más respuestas, y con ese material se puede afirmar cómo maneja la emoción bajo presión y qué hace cuando la situación se le complica.'
where codigo = 'Batería 2';

update baterias set descripcion =
  'Todo lo de la Batería 2 más un análisis del potencial de proyección: qué nivel de complejidad puede manejar hoy, hasta dónde puede llegar y en cuánto tiempo. Se toma sobre cinco minutos de su propio relato.'
where codigo = 'Batería 3';
