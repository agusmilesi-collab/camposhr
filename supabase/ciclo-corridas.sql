-- Ciclos y corridas — separa el material de la vez que se dicta.
-- Ejecutar en el SQL Editor después de ciclo.sql.
--
-- El problema que resuelve: las actividades colgaban de la empresa, así que el
-- segundo cliente obligaba a duplicar las diecisiete filas, y corregir una
-- consigna había que hacerlo en cada copia.
--
-- Ahora hay dos cosas separadas:
--
--   el ciclo    Liderazgos Humanos. Sus actividades se escriben una vez y
--               sirven para todos los clientes.
--
--   la corrida  el ciclo dictado a un cliente. Guarda su clave de control,
--               qué actividad tiene abierta y quiénes asistieron.
--
-- Todo en una transacción: si algo falla, la base queda como estaba.

begin;

-- ------------------------------------------------------------------- ciclos
create table if not exists public.ciclos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ciclos enable row level security;

insert into public.ciclos (nombre)
values ('Liderazgos Humanos')
on conflict (nombre) do nothing;

-- ----------------------------------------------------------------- corridas
-- Una corrida por vez que el ciclo se dicta a un cliente. Si el año que viene
-- el mismo cliente lo repite, es una corrida nueva: los asistentes son otros
-- y las respuestas no se mezclan.
--
-- `actividad_abierta_id` reemplaza al booleano que vivía en cada actividad.
-- Con la actividad compartida entre clientes, ese booleano abría la consigna
-- en la sala equivocada. Además hace que abrir sea una sola escritura, sin el
-- instante intermedio en que no había ninguna abierta.
create table if not exists public.corridas (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  ciclo_id             uuid not null references public.ciclos(id),
  -- La clave del enlace de control. Es por corrida: si fuera una sola para
  -- todo, quien controla un cliente podría abrir actividades en el de otro.
  clave_control        text not null,
  actividad_abierta_id uuid references public.actividades(id) on delete set null,
  activa               boolean not null default true,
  created_at           timestamptz not null default now()
);

create index if not exists corridas_empresa on public.corridas (empresa_id);
alter table public.corridas enable row level security;

-- La dirección del ciclo es la de la empresa, así que sólo puede haber una
-- corrida activa por empresa a la vez.
create unique index if not exists corridas_una_activa
  on public.corridas (empresa_id) where activa;

-- ------------------------------------------------- actividades: al ciclo
alter table public.actividades
  add column if not exists ciclo_id uuid references public.ciclos(id) on delete cascade;

update public.actividades
   set ciclo_id = (select id from public.ciclos where nombre = 'Liderazgos Humanos')
 where ciclo_id is null;

-- ------------------------------------------------- la corrida de Pla S.A.
-- Se crea con la clave que ya estaba en uso, así el enlace que las expositoras
-- tienen guardado sigue funcionando.
insert into public.corridas (empresa_id, ciclo_id, clave_control, actividad_abierta_id)
select e.id,
       (select id from public.ciclos where nombre = 'Liderazgos Humanos'),
       '601b108afac22ee15e70323d',
       (select a.id from public.actividades a where a.empresa_id = e.id and a.abierta limit 1)
  from public.empresas e
 where e.slug = 'pla-sa'
   and not exists (select 1 from public.corridas c where c.empresa_id = e.id);

-- --------------------------------------------- asistentes y aportes: a la corrida
alter table public.asistentes
  add column if not exists corrida_id uuid references public.corridas(id) on delete cascade;

update public.asistentes s
   set corrida_id = c.id
  from public.corridas c
 where s.corrida_id is null and c.empresa_id = s.empresa_id;

alter table public.aportes
  add column if not exists corrida_id uuid references public.corridas(id) on delete cascade;

update public.aportes p
   set corrida_id = s.corrida_id
  from public.asistentes s
 where p.corrida_id is null and s.id = p.asistente_id;

create index if not exists aportes_corrida on public.aportes (corrida_id, actividad_id);
create index if not exists asistentes_corrida on public.asistentes (corrida_id);

-- ------------------------------------------------------- lo que ya no va
-- Las actividades dejan de tener dueño y dejan de guardar su propio estado.
alter table public.actividades drop constraint if exists actividades_empresa_id_clave_key;
alter table public.actividades drop column if exists empresa_id;
alter table public.actividades drop column if exists abierta;
alter table public.actividades alter column ciclo_id set not null;
create unique index if not exists actividades_clave_ciclo
  on public.actividades (ciclo_id, clave);

alter table public.asistentes drop column if exists empresa_id;
alter table public.asistentes alter column corrida_id set not null;

alter table public.aportes alter column corrida_id set not null;

commit;
