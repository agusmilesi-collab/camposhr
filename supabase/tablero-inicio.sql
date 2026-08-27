-- El tablero de la home: en qué está cada evaluación y con qué prioridad.
--
-- Son dos cosas distintas de la etapa, y por eso no se guardan en `estado`.
-- La etapa dice dónde va la evaluación en el circuito (citar, entrevistar,
-- analizar, entregar); el tablero dice qué está haciendo hoy la evaluadora con
-- ella. Se puede estar trabajando en un informe que todavía figura como "Por
-- analizar" y no haber tocado otro que está en la misma etapa.
--
-- `tablero` en null es "por hacer": es donde entra todo lo abierto sin que
-- nadie tenga que moverlo, y la columna solo se escribe cuando se arrastra.
--
-- `prioridad` en null quiere decir "la que le toca por antigüedad": la calcula
-- la aplicación con los días desde que se solicitó (ver `prioridadPorDefecto`
-- en `lib/psicotecnicos-tipos.ts`). Se escribe solo cuando alguien la fija a
-- mano, así el orden se acomoda solo mientras nadie opine.
alter table public.evaluaciones
  add column if not exists tablero text,
  add column if not exists prioridad text;

alter table public.evaluaciones
  drop constraint if exists evaluaciones_tablero_check;
alter table public.evaluaciones
  add constraint evaluaciones_tablero_check
  check (tablero is null or tablero in ('por_hacer', 'haciendo', 'listo'));

alter table public.evaluaciones
  drop constraint if exists evaluaciones_prioridad_check;
alter table public.evaluaciones
  add constraint evaluaciones_prioridad_check
  check (prioridad is null or prioridad in ('alta', 'media', 'baja'));

comment on column public.evaluaciones.tablero is
  'Columna del tablero de inicio: por_hacer (null incluido), haciendo o listo. No es la etapa.';
comment on column public.evaluaciones.prioridad is
  'alta, media o baja, fijada a mano. Null: la calcula la aplicación por días desde la solicitud.';
