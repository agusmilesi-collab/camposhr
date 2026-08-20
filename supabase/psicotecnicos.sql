-- Psicotécnicos — esquema de Supabase.
--
-- Es el destino de la tabla Individuo de Airtable y de todo lo que cuelga de
-- ella. Se ejecuta de una sola vez y es idempotente.
--
-- **Acá viven datos sensibles.** Una evaluación psicológica de una persona
-- identificable está alcanzada por la ley de protección de datos y por el
-- secreto profesional de quien la administró. De ahí las tres decisiones de
-- este esquema:
--
--   1. Todo el acceso es server-side con la service key. RLS queda activo y
--      SIN políticas, así la clave anónima no lee ni escribe nada.
--   2. Lo clínico va en tablas aparte de lo operativo. Saber en qué etapa
--      está una persona no es lo mismo que leer su sumario estructural, y
--      separarlas permite que mañana una política deje pasar lo primero y no
--      lo segundo.
--   3. Toda lectura de una tabla clínica se anota en `accesos`. Es el
--      requisito que un repositorio de git no puede cumplir y el motivo por
--      el que estos datos vienen acá.
--
-- El puente con Airtable es la columna `airtable_id` de cada tabla: mientras
-- dure la migración, las dos mitades se reconcilian por ahí. Cuando Airtable
-- salga, la columna se borra y no queda nada más que tocar.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- empresas
-- La tabla ya existe por el ciclo y el cuestionario. Se le suma el puente con
-- Airtable, que es la duplicación de identidad de cliente que el spec de
-- arquitectura manda a reconciliar.
alter table public.empresas add column if not exists airtable_id text;
create unique index if not exists empresas_airtable_id_key
  on public.empresas (airtable_id) where airtable_id is not null;

-- ------------------------------------------------------------ evaluadoras
-- Quién administra y firma. Es la identidad que después tiene que aparecer en
-- el registro de accesos, así que vive en una tabla y no en un texto suelto.
create table if not exists public.evaluadoras (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text,
  nombre      text not null,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists evaluadoras_airtable_id_key
  on public.evaluadoras (airtable_id) where airtable_id is not null;

alter table public.evaluadoras enable row level security;

-- --------------------------------------------------------------- baterías
-- Qué tests entran en cada batería, con su precio y su duración. Es lo que
-- define el trabajo de una evaluación y lo que se factura.
create table if not exists public.baterias (
  id           uuid primary key default gen_random_uuid(),
  airtable_id  text,
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text,
  precio       numeric(12,2),
  duracion_min integer,
  tests        text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create unique index if not exists baterias_airtable_id_key
  on public.baterias (airtable_id) where airtable_id is not null;

alter table public.baterias enable row level security;

-- --------------------------------------------------------------- personas
-- La identidad y nada más, como pide el spec de arquitectura: los datos de
-- cada servicio cuelgan de la participación y no de acá. Es lo que permite
-- que la evaluación psicotécnica y las respuestas de una charla convivan sin
-- que una consulta pueda devolver las dos juntas.
--
-- `empresa_id` es la empresa que la trajo, no un dueño: una persona evaluada
-- para una búsqueda puede después aparecer en el mapeo de otra.
create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  airtable_id    text,
  empresa_id     uuid references public.empresas (id) on delete set null,
  nombre         text not null,
  email          text,
  telefono       text,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create unique index if not exists personas_airtable_id_key
  on public.personas (airtable_id) where airtable_id is not null;
create index if not exists personas_empresa_idx on public.personas (empresa_id);

alter table public.personas enable row level security;

-- ---------------------------------------------------------------- pedidos
-- Una búsqueda de un cliente. Es la unidad que se cotiza y se factura.
create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  airtable_id   text,
  empresa_id    uuid not null references public.empresas (id) on delete restrict,
  bateria_id    uuid references public.baterias (id) on delete set null,
  puesto        text not null,
  familia       text,
  seniority     text,
  estado        text not null default 'Abierto',
  fecha_pedido  date,
  notas         text,
  contexto      text,
  created_at    timestamptz not null default now()
);

create unique index if not exists pedidos_airtable_id_key
  on public.pedidos (airtable_id) where airtable_id is not null;
create index if not exists pedidos_empresa_idx on public.pedidos (empresa_id);

alter table public.pedidos enable row level security;

-- ----------------------------------------------------------- evaluaciones
-- La participación de una persona en un pedido: el expediente operativo.
--
-- Acá va lo que se necesita para operar el día (en qué etapa está, cuándo es
-- la entrevista, quién la toma) y NO va nada clínico. Lo clínico cuelga de
-- esta fila en las tablas de abajo.
create table if not exists public.evaluaciones (
  id               uuid primary key default gen_random_uuid(),
  airtable_id      text,
  persona_id       uuid not null references public.personas (id) on delete cascade,
  pedido_id        uuid references public.pedidos (id) on delete set null,
  evaluadora_id    uuid references public.evaluadoras (id) on delete set null,

  estado           text not null default 'Sin asignar'
                   check (estado in ('Sin asignar','Por citar','Por entrevistar',
                                    'Por analizar','Entregado','Seguimiento')),
  mensaje          text check (mensaje in ('Sin contactar','Esperando respuesta')),
  modalidad        text check (modalidad in ('Presencial','Online')),

  fecha_ingreso    date,
  fecha_entrevista timestamptz,
  fecha_entrega    date,

  -- Qué se administró. Son las tildes que la psicóloga marca en la sesión.
  bender_administrado  boolean not null default false,
  grafico_2_personas_administrado boolean not null default false,

  -- La conclusión del informe. Los dos juegos de opciones conviven porque son
  -- de servicios distintos: selección mide a la persona sola, mapeo la mide
  -- contra la demanda del puesto. Cuál queda es una decisión abierta del spec
  -- de la sesión de decisión.
  recomendacion    text check (recomendacion in (
                     'Apto','Apto con observaciones','Apto con alertas','No apto',
                     'Encaja con el puesto','Encaja, con desarrollo',
                     'Encaja si cambia el puesto','Sin puesto contra el cual medir')),

  -- El informe entregado, como objeto de Storage privado. Nunca como adjunto
  -- público ni como archivo del repositorio.
  informe_path     text,

  -- Cobro: dos tildes, sin importe ni número de factura.
  facturado        boolean,
  pagado           boolean,

  created_at       timestamptz not null default now(),
  actualizado_at   timestamptz not null default now()
);

create unique index if not exists evaluaciones_airtable_id_key
  on public.evaluaciones (airtable_id) where airtable_id is not null;
create index if not exists evaluaciones_persona_idx on public.evaluaciones (persona_id);
create index if not exists evaluaciones_pedido_idx on public.evaluaciones (pedido_id);
create index if not exists evaluaciones_estado_idx on public.evaluaciones (estado);
create index if not exists evaluaciones_evaluadora_idx on public.evaluaciones (evaluadora_id);

alter table public.evaluaciones enable row level security;

-- ------------------------------------------------------- sumario de Exner
-- El sumario estructural del Rorschach. Lo calcula el motor y no una persona,
-- así que las columnas son el resultado y `crudo` guarda el JSON completo con
-- el que se calculó, para poder rehacer la cuenta.
--
-- Es dato clínico: se lee con registro de acceso.
create table if not exists public.sumario_exner (
  evaluacion_id  uuid primary key references public.evaluaciones (id) on delete cascade,
  r              integer,
  lambda         numeric,
  ea             numeric,
  es             numeric,
  d              integer,
  adj_d          integer,
  eb             text,
  estilo         text,
  wsumc          numeric,
  afr            numeric,
  xa_pct         numeric,
  x_mas_pct      numeric,
  xu_pct         numeric,
  x_menos_pct    numeric,
  zd             numeric,
  ego            numeric,
  scon           integer,
  scon_pos       boolean,
  depi           integer,
  depi_pos       boolean,
  cdi            integer,
  cdi_pos        boolean,
  hvi_pos        boolean,
  obs_pos        boolean,
  pti            integer,
  pti_pos        boolean,
  crudo          jsonb,
  actualizado_at timestamptz not null default now()
);

alter table public.sumario_exner enable row level security;

-- ---------------------------------------------------- respuestas Rorschach
-- Una fila por respuesta codificada. Es la materia prima del sumario: si se
-- pierde, el sumario no se puede rehacer ni defender.
create table if not exists public.rorschach_respuestas (
  id             uuid primary key default gen_random_uuid(),
  airtable_id    text,
  evaluacion_id  uuid not null references public.evaluaciones (id) on delete cascade,
  test           text,
  lamina         text,
  n_respuesta    integer,
  localizacion   text,
  n_localizacion text,
  determinantes  text[] not null default '{}',
  fq             text,
  par            boolean not null default false,
  contenidos     text[] not null default '{}',
  popular        boolean not null default false,
  z              numeric,
  cc_ee          text[] not null default '{}',
  agc            boolean not null default false,
  sl             boolean not null default false,
  created_at     timestamptz not null default now()
);

create unique index if not exists rorschach_airtable_id_key
  on public.rorschach_respuestas (airtable_id) where airtable_id is not null;
create index if not exists rorschach_evaluacion_idx
  on public.rorschach_respuestas (evaluacion_id);

alter table public.rorschach_respuestas enable row level security;

-- --------------------------------------------------------------- Benziger
-- Los cuadrantes, el estrés y los adjetivos. Las 67 columnas de Airtable son
-- bloques con la misma forma repetidos, así que van como JSON por bloque: el
-- día que cambie el cuestionario no hay que migrar el esquema.
create table if not exists public.benziger (
  evaluacion_id       uuid primary key references public.evaluaciones (id) on delete cascade,
  cuadrantes          jsonb not null default '{}',
  cuadrante_preferente text[] not null default '{}',
  estres              jsonb not null default '{}',
  adjetivos           jsonb not null default '{}',
  abiertas            jsonb not null default '{}',
  resumen             text,
  pdf_path            text,
  actualizado_at      timestamptz not null default now()
);

alter table public.benziger enable row level security;

-- ------------------------------------------------------------------ Raven
create table if not exists public.raven (
  evaluacion_id  uuid primary key references public.evaluaciones (id) on delete cascade,
  raw            integer,
  percentil      numeric,
  desvios        numeric,
  resultado      text,
  actualizado_at timestamptz not null default now()
);

alter table public.raven enable row level security;

-- ------------------------------------------------------ tests cualitativos
create table if not exists public.tests_cualitativos (
  id             uuid primary key default gen_random_uuid(),
  airtable_id    text,
  evaluacion_id  uuid not null references public.evaluaciones (id) on delete cascade,
  test           text not null,
  fecha          date,
  observaciones  text,
  interpretacion text,
  hallazgos      text,
  created_at     timestamptz not null default now()
);

create unique index if not exists tests_cualitativos_airtable_id_key
  on public.tests_cualitativos (airtable_id) where airtable_id is not null;
create index if not exists tests_cualitativos_evaluacion_idx
  on public.tests_cualitativos (evaluacion_id);

alter table public.tests_cualitativos enable row level security;

-- ----------------------------------------------------- puntajes del informe
-- Una fila por competencia puntuada, con la justificación y de qué indicador
-- salió. Es lo que hace auditable un informe: cada número muestra su origen.
create table if not exists public.informe_competencias (
  id            uuid primary key default gen_random_uuid(),
  airtable_id   text,
  evaluacion_id uuid not null references public.evaluaciones (id) on delete cascade,
  competencia   text not null,
  puntaje       numeric,
  indicadores   text[] not null default '{}',
  justificacion text,
  texto         text,
  created_at    timestamptz not null default now()
);

create unique index if not exists informe_competencias_airtable_id_key
  on public.informe_competencias (airtable_id) where airtable_id is not null;
create index if not exists informe_competencias_evaluacion_idx
  on public.informe_competencias (evaluacion_id);

alter table public.informe_competencias enable row level security;

-- --------------------------------------------------------------- accesos
-- Quién leyó qué y cuándo.
--
-- Es la mitad del requisito que trajo estos datos acá: sin esto, "no queda
-- constancia de quién abrió qué" sigue siendo verdad y da igual la base que
-- se use. Se escribe desde el servidor en cada lectura de una tabla clínica.
--
-- `quien` es el identificador de la persona del equipo. Mientras el OS entre
-- con una clave compartida guarda 'equipo', que no alcanza para auditar y sí
-- para dejar el registro andando desde el primer día.
create table if not exists public.accesos (
  id          bigserial primary key,
  ocurrido_at timestamptz not null default now(),
  quien       text not null,
  accion      text not null check (accion in ('lectura','escritura','descarga')),
  recurso     text not null,
  recurso_id  uuid,
  detalle     jsonb not null default '{}'
);

create index if not exists accesos_ocurrido_idx on public.accesos (ocurrido_at desc);
create index if not exists accesos_recurso_idx on public.accesos (recurso, recurso_id);

alter table public.accesos enable row level security;

-- ---------------------------------------------------------------- Storage
-- Los informes y los escaneos, en un bucket privado. Se sirven por una URL
-- firmada y de vida corta, nunca por una dirección pública.
insert into storage.buckets (id, name, public)
values ('psicotecnicos', 'psicotecnicos', false)
on conflict (id) do nothing;

-- --------------------------------------------------------- actualizado_at
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

drop trigger if exists personas_tocar on public.personas;
create trigger personas_tocar before update on public.personas
  for each row execute function public.tocar_actualizado();

drop trigger if exists evaluaciones_tocar on public.evaluaciones;
create trigger evaluaciones_tocar before update on public.evaluaciones
  for each row execute function public.tocar_actualizado();

-- ------------------------------------------------ alta interna y por portal
-- Un pedido puede entrar por dos puertas: el cliente lo carga en su portal o
-- manda un mail y lo carga una psicóloga. Las dos terminan en la misma fila;
-- `origen` guarda por cuál entró, que es lo único que las distingue después.
alter table public.pedidos  add column if not exists origen text not null default 'interno'
  check (origen in ('interno','portal'));
alter table public.personas add column if not exists origen text not null default 'interno'
  check (origen in ('interno','portal'));

-- El CV, como objeto del bucket privado.
alter table public.personas add column if not exists cv_path text;
