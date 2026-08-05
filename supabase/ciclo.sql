-- Ciclo de encuentros con actividades desde el teléfono — esquema de Supabase.
-- Ejecutar en el SQL Editor del proyecto, después de schema.sql.
--
-- Mismo criterio que el cuestionario: todo el acceso es server-side con la
-- service key desde Next, así que RLS queda activo y sin políticas.
--
-- Tres tablas:
--   asistentes   quién es cada persona, una vez por ciclo y no por encuentro
--   actividades  qué se puede responder, y cuál está abierta en este momento
--   aportes      lo que respondió cada persona en cada actividad

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- asistentes
-- La persona se registra una sola vez y queda para todos los encuentros del
-- ciclo. Eso es lo que permite que el segundo día no vuelva a cargar nada.
--
-- La selfie cumple dos funciones: aparece en la matriz del equipo y sirve para
-- que la persona se reconozca al volver. Si cambió de teléfono o borró los
-- datos del navegador, ve la grilla de caras y toca la suya, que es más rápido
-- y más seguro que escribir un código.
create table if not exists public.asistentes (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null,
  apellido   text not null,
  foto_path  text,
  created_at timestamptz not null default now()
);

create index if not exists asistentes_empresa on public.asistentes (empresa_id);
alter table public.asistentes enable row level security;

-- -------------------------------------------------------------- actividades
-- Cada momento de la charla en que la gente responde algo desde el teléfono.
--
-- `clave` la identifica dentro de la empresa y es la que usa el deck y la
-- pantalla de control: se elige a mano y se lee, por ejemplo 'c1-multitarea'.
--
-- `tipo` decide qué formulario se muestra y cómo se agrega el resultado. Son
-- pocos y fijos a propósito: diez actividades distintas se arman combinando
-- estos cinco, y así una actividad nueva no es un desarrollo nuevo.
--
-- `abierta` es lo único que la expositora toca durante el encuentro. El
-- teléfono de cada persona muestra la actividad abierta y nada más, así no hay
-- menú donde perderse ni forma de adelantarse.
create table if not exists public.actividades (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  clave      text not null,
  charla     smallint not null,
  orden      smallint not null default 0,
  tipo       text not null check (tipo in ('palabra','opcion','escala','texto','marcas')),
  titulo     text not null,
  enunciado  text,
  -- Para 'opcion' y 'marcas': las alternativas, en orden.
  opciones   jsonb not null default '[]'::jsonb,
  abierta    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (empresa_id, clave)
);

create index if not exists actividades_empresa on public.actividades (empresa_id, charla, orden);
alter table public.actividades enable row level security;

-- ------------------------------------------------------------------ aportes
-- Una fila por persona y por actividad. El valor se guarda como jsonb porque
-- cambia según el tipo: una palabra, una opción elegida, un número, un texto o
-- una lista de marcas.
--
-- La clave única evita el doble envío: si la persona responde otra vez, se
-- pisa su respuesta anterior en lugar de sumar una fila nueva.
create table if not exists public.aportes (
  id           uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  asistente_id uuid not null references public.asistentes(id) on delete cascade,
  valor        jsonb not null,
  created_at   timestamptz not null default now(),
  unique (actividad_id, asistente_id)
);

create index if not exists aportes_actividad on public.aportes (actividad_id);
alter table public.aportes enable row level security;
