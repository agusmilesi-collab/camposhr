-- Si el test de manchas se administró.
--
-- Hasta ahora se deducía de la codificación: si había respuestas cargadas, se
-- había tomado. Pero entre administrar y codificar pasan días, y en el medio la
-- evaluación queda igual que si nunca se hubiera tomado. La marca se pone en la
-- entrevista, con la persona enfrente, como la del Bender y la del gráfico.
--
-- Una sola columna para los dos tests: a un candidato se le toma Rorschach o
-- Zulliger, nunca los dos, y cuál fue lo dice la batería.

alter table evaluaciones
  add column if not exists proyectivo_administrado boolean not null default false;

comment on column evaluaciones.proyectivo_administrado is
  'Si se administró el test de manchas (Rorschach o Zulliger, según la batería).';
