-- Los intentos fallidos de entrar a la zona del inquilino, para poder frenarlos.
--
-- El ingreso del Centro no tenía tope: contra el correo de un inquilino se
-- podían probar contraseñas sin límite. Va en una tabla aparte de
-- `os_intentos` a propósito: el OS tiene un tope general que cuenta todas las
-- filas, y los errores de un inquilino no tienen por qué dejar afuera al equipo.
create table if not exists public.centro_intentos (
  id        bigint generated always as identity primary key,
  correo    text not null,
  ip        text not null,
  creado_at timestamptz not null default now()
);
create index if not exists centro_intentos_creado_idx on public.centro_intentos (creado_at desc);
alter table public.centro_intentos enable row level security;
