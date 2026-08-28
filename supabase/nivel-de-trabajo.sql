-- El nivel de trabajo del puesto, que es contra lo que se mide a la persona.
--
-- Jaques mide el nivel de un rol por su **time-span**: el tiempo máximo de
-- finalización de la tarea más larga que ese puesto tiene que llevar hasta el
-- final. Es una medida objetiva y sus cortes son los mismos que los del
-- horizonte temporal de la persona (tres meses, un año, dos años, cinco, diez),
-- así que las dos puntas caen en la misma escala y se pueden comparar.
--
-- `complejidad` guarda las respuestas a las cinco preguntas del procedimiento
-- del libro, por sí o por no, y no solo el resultado: el estrato es la más alta
-- contestada que sí, y guardar las respuestas deja registrado por qué dio eso.
--
-- `estrato_puesto` es el que rige. Sale solo de los dos anteriores; queda como
-- columna propia porque cuando los dos caminos discrepan lo resuelve la
-- evaluadora, y esa decisión hay que guardarla.
alter table pedidos
  add column if not exists time_span_dias integer,
  add column if not exists complejidad jsonb,
  add column if not exists estrato_puesto smallint;

comment on column pedidos.time_span_dias is
  'Time-span del rol: tiempo máximo de finalización de la tarea más larga que el puesto lleva hasta el final, en días.';
comment on column pedidos.complejidad is
  'Respuestas a las cinco preguntas de complejidad de tarea, {"1":true,"2":false,...}. El estrato es la más alta en true.';
comment on column pedidos.estrato_puesto is
  'El estrato que rige para el puesto, del I al VII. Sale del time-span y de las preguntas; se corrige a mano cuando discrepan.';

-- Y lo mismo del lado de la persona: las mismas preguntas, contestadas sobre
-- las dos o tres asignaciones que manejó al límite de lo que pudo, que es como
-- el libro indica juzgarlo.
alter table analisis_discursivo
  add column if not exists complejidad jsonb;

comment on column analisis_discursivo.complejidad is
  'Respuestas a las cinco preguntas de complejidad, sobre las asignaciones que la persona manejó al límite de su capacidad.';
