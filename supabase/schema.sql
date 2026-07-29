-- Cuestionario de Perfil (Benziger adaptado) — esquema de Supabase.
-- Ejecutar en el SQL Editor del proyecto de Supabase, de una sola vez.
--
-- Todo el acceso se hace server-side con la service key desde Next.
-- Por eso RLS queda activo y SIN políticas: la clave anónima no lee ni
-- escribe nada, y la service key la saltea por diseño.
--
-- El esquema contempla dos variantes del cuestionario:
--   'perfil'      -> las 8 placas de cuadrantes.
--   'generaciones'-> las mismas 8 placas + 4 de generaciones, y pide el
--                    líder al que reporta la persona. De esta variante
--                    salen los informes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- empresas
create table if not exists public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.empresas enable row level security;

-- ----------------------------------------------------------------- líderes
-- Los líderes de cada empresa. La persona elige el suyo de una lista, así
-- los informes agrupan por equipo sin depender de cómo se escribió el nombre.
create table if not exists public.lideres (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

alter table public.lideres enable row level security;

create index if not exists lideres_empresa_idx on public.lideres (empresa_id);

-- ------------------------------------------------------------- respuestas
-- Una fila por persona que completa el cuestionario.
--
--   variante   : 'perfil' | 'generaciones'
--   likert     : {"BI":4,"BD":2,"FD":5,"FI":1}          (0 a 5 cada uno)
--   checklist  : {"BI":9,"BD":3,"FD":12,"FI":6}         (0 a 15 cada uno)
--   totales    : likert + checklist por perfil          (0 a 20 cada uno)
--   detalle    : respuestas crudas, para poder recalcular si cambia el scoring
--   perfiles   : perfil(es) resultante(s), ej. ["FD"] o ["FD","BD"]
--   resultado  : 'definido' | 'doble' | 'mixto'
--   extra      : bloques adicionales de la variante (generaciones, etc.)
--   generacion : etiqueta generacional, cuando la variante la determina
create table if not exists public.respuestas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  variante     text not null default 'perfil',
  lider_id     uuid references public.lideres (id) on delete set null,
  lider_nombre text,             -- copia del nombre al momento de responder
  nombre       text not null,
  likert       jsonb not null,
  checklist    jsonb not null,
  totales      jsonb not null,
  detalle      jsonb not null,
  perfiles     text[] not null,
  resultado    text not null,
  eje_x        real not null,    -- -1 (izquierdo) a 1 (derecho)
  eje_y        real not null,    -- -1 (basal) a 1 (frontal)
  extra        jsonb not null default '{}'::jsonb,
  generacion   text,
  foto_path    text,             -- ruta dentro del bucket 'selfies'; null si no hay foto
  created_at   timestamptz not null default now()
);

alter table public.respuestas enable row level security;

create index if not exists respuestas_empresa_idx
  on public.respuestas (empresa_id, created_at desc);
create index if not exists respuestas_lider_idx
  on public.respuestas (lider_id);
create index if not exists respuestas_variante_idx
  on public.respuestas (empresa_id, variante);

-- ------------------------------------------------------------------ fotos
-- Bucket privado para las selfies. La matriz interna las muestra con URLs
-- firmadas de corta duración; nunca quedan expuestas de forma pública.
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------- semilla
insert into public.empresas (nombre, slug)
values ('Pla S.A.', 'pla-sa')
on conflict (slug) do nothing;

-- --------------------------------------------------- enlace propio del líder
-- Cada líder tiene un enlace secreto con el que ve el playbook de su equipo,
-- sin cuenta ni contraseña. El token se genera solo al dar de alta al líder.
alter table public.lideres
  add column if not exists token text unique
  default encode(gen_random_bytes(16), 'hex');

update public.lideres
   set token = encode(gen_random_bytes(16), 'hex')
 where token is null;
