-- Lo que las psicólogas pueden mover sin tocar el código.
--
-- Tres cosas del motor son criterio clínico y no decisión técnica: dónde cortan
-- los rangos del Raven, cuánto pesa cada indicador dentro de su competencia y
-- qué dice cada lectura. Estaban escritas en el código, así que cambiarlas
-- pedía una entrega, y el criterio de quien firma el informe quedaba a la
-- espera de que alguien tuviera tiempo.
--
-- **Una clave por conjunto y solo lo que se cambió.** El código sigue trayendo
-- el valor de fábrica; acá se guarda la diferencia. Una clave que no está
-- significa "usá lo de fábrica", que no es lo mismo que un valor vacío, y
-- volver atrás es borrar la clave. Es la misma forma que `informe_listas`.
create table if not exists public.ajustes (
  clave      text primary key,
  valor      jsonb not null,
  quien      text,
  actualizado_at timestamptz not null default now()
);

alter table public.ajustes enable row level security;

comment on table public.ajustes is
  'Lo que se puede mover desde Sistema. Clave ausente = el valor de fábrica del código.';

drop trigger if exists ajustes_tocar on public.ajustes;
create trigger ajustes_tocar before update on public.ajustes
  for each row execute function public.tocar_actualizado();
