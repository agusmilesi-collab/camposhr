-- Quién trabaja en el OS y qué alcanza a ver.
--
-- Es la tabla de cuentas sin las cuentas. Hoy la identidad se elige de un
-- selector y viaja en una cookie, porque mientras se construye el sistema
-- iniciar sesión para ver una corrección cuesta más de lo que ordena. El día
-- que haya cuentas, a esta tabla se le suman el correo y el identificador de
-- Supabase Auth, y lo que hoy es una preferencia pasa a ser un permiso.
--
-- `alcance` es la regla entera:
--   'todo'   -> ve el trabajo de todas.
--   'propio' -> ve lo que tiene asignado, más lo que todavía no tiene dueño.
--
-- `evaluadora_id` vincula al miembro con su fila de `evaluadoras`, que es
-- contra la que se compara cada evaluación. Quien no administra tests no lo
-- tiene, y por eso es nulo.

create table if not exists public.equipo (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  alcance       text not null default 'propio' check (alcance in ('todo','propio')),
  evaluadora_id uuid references public.evaluadoras (id) on delete set null,
  activo        boolean not null default true,
  orden         integer not null default 100,
  created_at    timestamptz not null default now()
);

alter table public.equipo enable row level security;

insert into public.equipo (nombre, alcance, evaluadora_id, orden)
values ('Agustín', 'todo', null, 1)
on conflict (nombre) do update
  set alcance = excluded.alcance, orden = excluded.orden;

insert into public.equipo (nombre, alcance, evaluadora_id, orden)
select ev.nombre, 'propio', ev.id, 10
from public.evaluadoras ev
on conflict (nombre) do update
  set evaluadora_id = excluded.evaluadora_id;
