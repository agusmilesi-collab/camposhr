-- Cuántas de las preguntas más votadas se revelaron en la placa del ranking.
--
-- La placa muestra primero la tercera, y quien dicta revela la segunda y la
-- primera con un botón. Va aparte de `fase` porque la fase vuelve a cero cada
-- vez que se abre o se cierra una consigna, y en el medio se cierran los
-- teléfonos y al final se vuelven a abrir para que reclamen el premio.
--
--   0 · solo la tercera
--   1 · la tercera y la segunda
--   2 · las tres: se habilita reclamar el premio de la primera

alter table public.corridas
  add column if not exists revelado smallint not null default 0
  check (revelado between 0 and 2);
