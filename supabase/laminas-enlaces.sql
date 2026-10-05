-- El enlace de las láminas para la persona evaluada.
--
-- En la encuesta del Rorschach la persona señala dónde vio cada cosa, y para
-- señalar necesita la lámina en su propia pantalla, con su cursor. La pantalla
-- de láminas vive en el OS, detrás de la clave del equipo, que a ella no se le
-- puede dar: entra con un token, como en el Raven.
--
-- **Vence a las 24 horas.** Las láminas tienen derechos y una que circula deja
-- de servir para quien ya la vio: el enlace alcanza para la sesión del día y
-- no queda abierto en el historial de nadie.
create table if not exists public.laminas_enlaces (
  token         text primary key,
  evaluacion_id uuid not null references public.evaluaciones (id) on delete cascade,
  test          text not null,
  creado_at     timestamptz not null default now(),
  vence_at      timestamptz not null default now() + interval '24 hours'
);

create index if not exists laminas_enlaces_evaluacion_idx
  on public.laminas_enlaces (evaluacion_id, test, vence_at desc);

alter table public.laminas_enlaces enable row level security;

-- Los intentos fallidos de entrar al OS, para poder frenarlos.
--
-- La clave del equipo es corta. Sin tope, un programa prueba todas las
-- combinaciones en minutos; con tope por dirección y tope general, tarda
-- semanas y deja rastro. Las filas viejas no sirven para nada: se borran al
-- anotar una nueva.
create table if not exists public.os_intentos (
  id        bigint generated always as identity primary key,
  ip        text not null,
  creado_at timestamptz not null default now()
);
create index if not exists os_intentos_creado_idx on public.os_intentos (creado_at desc);
alter table public.os_intentos enable row level security;

-- Qué lámina tiene que estar viendo la persona. La escribe la pantalla de
-- codificación cada vez que la evaluadora pasa de lámina, y la pantalla de la
-- persona la consulta cada segundo y medio: son dos máquinas, y el aviso entre
-- pestañas que mueve las dos pantallas de la evaluadora no llega de una a otra.
alter table public.laminas_enlaces add column if not exists lamina integer;
