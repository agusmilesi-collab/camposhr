-- Las fichas de los pacientes de cada inquilino y su historia clínica.
--
-- Es la consulta del profesional, no el Centro: lo escribe y lo lee solo él
-- desde su zona, con su sesión. El equipo del Centro no ve estas tablas y el
-- modo "mirar" desde el OS tampoco. Son datos de salud de terceros (datos
-- sensibles por la ley 25.326): el responsable es el profesional que los
-- carga; el sistema los guarda en la base con RLS, como todo lo demás.
--
-- Los campos son los de una ficha de consultorio particular en Argentina:
-- identidad y contacto, cobertura, quién lo derivó, el motivo de la primera
-- consulta y los antecedentes que cualquier profesional de la salud pregunta
-- (enfermedades previas, medicación, alergias). Lo que varía por profesión va
-- en texto libre, no en campos.
create table if not exists public.centro_pacientes (
  id                  uuid primary key default gen_random_uuid(),
  inquilino_id        uuid not null references public.inquilinos (id) on delete cascade,
  nombre              text not null check (length(trim(nombre)) > 0),
  apellido            text not null default '',
  dni                 text,
  fecha_nacimiento    date,
  telefono            text,
  correo              text,
  direccion           text,
  cobertura           text,
  afiliado            text,
  contacto_emergencia text,
  derivado_por        text,
  motivo_consulta     text,
  antecedentes        text,
  medicacion          text,
  alergias            text,
  notas               text,
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists centro_pacientes_inquilino_idx on public.centro_pacientes (inquilino_id, apellido, nombre);
alter table public.centro_pacientes enable row level security;

-- La historia clínica: una entrada por consulta, con fecha y texto libre
-- (qué trajo, qué se evaluó, qué se hizo o se indicó). No se borra: se corrige.
create table if not exists public.centro_evoluciones (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.centro_pacientes (id) on delete cascade,
  inquilino_id  uuid not null references public.inquilinos (id) on delete cascade,
  fecha         date not null,
  texto         text not null check (length(trim(texto)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists centro_evoluciones_paciente_idx on public.centro_evoluciones (paciente_id, fecha desc);
alter table public.centro_evoluciones enable row level security;

-- El turno puede apuntar a la ficha: así desde la agenda se abre la historia.
alter table public.centro_turnos add column if not exists paciente_id uuid references public.centro_pacientes (id) on delete set null;
