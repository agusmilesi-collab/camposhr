-- Las columnas del tablero de la home pasan a ser cuatro.
--
-- Antes eran tres (por_hacer, haciendo, listo) y la de terminadas se llenaba a
-- mano: había que arrastrar ahí lo que ya estaba entregado, y una tarjeta que
-- nadie movía se quedaba en curso para siempre. Ahora entregar el informe es lo
-- que la manda a Listo, así que esa columna sale de la etapa y no se guarda:
-- `listo` deja de ser un valor posible.
--
-- Y lo que entra ya no cae en la columna del día. Con todo lo abierto ahí,
-- "hoy" no quería decir nada: son las que se eligieron para hoy, y el resto
-- espera en el backlog, que es de donde se sacan.
--
--     por_hacer -> backlog   (null sigue siendo backlog)
--     haciendo  -> en_curso
--     listo     -> se borra: esa columna la decide la etapa
alter table public.evaluaciones
  drop constraint if exists evaluaciones_tablero_check;

update public.evaluaciones set tablero = 'backlog'  where tablero = 'por_hacer';
update public.evaluaciones set tablero = 'en_curso' where tablero = 'haciendo';
update public.evaluaciones set tablero = null       where tablero = 'listo';

alter table public.evaluaciones
  add constraint evaluaciones_tablero_check
  check (tablero is null or tablero in ('backlog', 'hoy', 'en_curso'));

comment on column public.evaluaciones.tablero is
  'Columna del tablero de inicio: backlog (null incluido), hoy o en_curso. Listo sale de la etapa, no de acá.';
