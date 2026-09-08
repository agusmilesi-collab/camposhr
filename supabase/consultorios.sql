-- Los consultorios del Centro Integral Santiago: espacios, precios, apertura y
-- reservas.
--
-- El esquema completo de la fase 1 está en `CAMPOS OS/SPECS-consultorios.md`.
-- Acá van las decisiones que solo se ven en el SQL.
--
-- **La disponibilidad no se guarda.** Es la apertura, menos los cierres, menos
-- lo reservado. Una columna de "libre" es una que puede quedar desactualizada, y
-- el problema que este sistema resuelve es justamente que nadie sepa con
-- certeza si el consultorio 2 está libre el 18/9 de 17 a 20.
--
-- **El día de la semana se cuenta con lunes en 0**, como `DIAS` en
-- `lib/opciones.ts`, y no como el `dow` de Postgres, que arranca en domingo. El
-- Centro abre de lunes a viernes, así que los valores válidos son 0 a 4.
--
-- **Las horas se guardan sin huso.** `fecha` y las dos horas son lo que se lee
-- en la pantalla, y `franja` se deriva de las tres. Con `timestamptz` una
-- reserva de las 17 se convierte a otra hora según dónde corra el servidor, que
-- es exactamente el error que no se puede permitir en un calendario de sala.

create extension if not exists btree_gist;

-- ------------------------------------------------------------------ espacios

create table if not exists public.espacios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  tipo       text not null check (tipo in ('consultorio', 'sum')),
  -- La categoría es la columna de la lista de precios: los consultorios 1 y 3
  -- comparten precio (A), el 2 va aparte (B) y el SUM tiene el suyo.
  categoria  text not null check (categoria in ('A', 'B', 'SUM')),
  orden      smallint not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  check ((tipo = 'sum') = (categoria = 'SUM'))
);

create table if not exists public.espacio_incluye (
  id         uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios (id) on delete cascade,
  texto      text not null check (length(trim(texto)) > 0),
  orden      smallint not null default 0
);

create index if not exists espacio_incluye_espacio_idx
  on public.espacio_incluye (espacio_id, orden);

-- ------------------------------------------------------------------- tarifas

-- La escala: precio por hora según cuántas horas semanales tiene contratadas la
-- persona en ese espacio, y según la categoría del espacio.
--
-- Una actualización no pisa la anterior: agrega la escala entera con una fecha
-- nueva en `desde`, y cada reserva ya cobrada conserva el importe que congeló.
-- Los valores se actualizan cuatro veces al año, en enero, abril, julio y
-- octubre.
--
-- El SUM tiene una sola fila, la del tramo 1: se alquila por hora suelta y no
-- por bandas semanales.
create table if not exists public.tarifas (
  id                 uuid primary key default gen_random_uuid(),
  categoria          text not null check (categoria in ('A', 'B', 'SUM')),
  horas_semana_desde smallint not null check (horas_semana_desde >= 1),
  precio_hora        numeric(12,2) not null check (precio_hora > 0),
  desde              date not null,
  created_at         timestamptz not null default now(),
  unique (categoria, horas_semana_desde, desde)
);

-- ------------------------------------------------------- apertura y cierres

create table if not exists public.apertura (
  id          uuid primary key default gen_random_uuid(),
  espacio_id  uuid not null references public.espacios (id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 4),
  desde_hora  time not null,
  hasta_hora  time not null,
  check (hasta_hora > desde_hora),
  unique (espacio_id, dia_semana)
);

-- Un cierre sin espacio es de todo el Centro (un feriado). Uno sin horas es el
-- día entero.
create table if not exists public.cierres (
  id         uuid primary key default gen_random_uuid(),
  espacio_id uuid references public.espacios (id) on delete cascade,
  fecha      date not null,
  desde_hora time,
  hasta_hora time,
  motivo     text not null check (length(trim(motivo)) > 0),
  created_at timestamptz not null default now(),
  check (
    (desde_hora is null and hasta_hora is null)
    or (desde_hora is not null and hasta_hora is not null and hasta_hora > desde_hora)
  )
);

create index if not exists cierres_fecha_idx on public.cierres (fecha);

-- ---------------------------------------------------------------- inquilinos

-- El profesional que alquila. Entra al sistema con correo y contraseña, que es
-- distinto del resto del OS: acá cada uno ve lo suyo y firma sus reservas.
--
-- `hash` queda en null hasta que la persona usa el enlace de alta y elige su
-- contraseña.
--
-- El legajo es requisito para reservar, como pide el documento de convivencia:
-- matrícula profesional vigente y DNI antes de empezar a usar el Centro.
create table if not exists public.inquilinos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null check (length(trim(nombre)) > 0),
  correo              text not null,
  hash                text,
  telefono            text,
  activo              boolean not null default true,
  matricula           text,
  matricula_vence     date,
  dni_archivo         text,
  matricula_archivo   text,
  llave_entregada     boolean not null default false,
  normas_version      text,
  normas_aceptadas_at timestamptz,
  created_at          timestamptz not null default now()
);

create unique index if not exists inquilinos_correo_idx
  on public.inquilinos (lower(correo));

-- ----------------------------------------------------- contratos y reservas

-- La banda semanal. No es el calendario: es la plantilla que genera las
-- reservas de cada mes cuando ese mes se abre.
create table if not exists public.contratos (
  id             uuid primary key default gen_random_uuid(),
  inquilino_id   uuid not null references public.inquilinos (id) on delete cascade,
  espacio_id     uuid not null references public.espacios (id),
  dia_semana     smallint not null check (dia_semana between 0 and 4),
  desde_hora     time not null,
  hasta_hora     time not null,
  vigente_desde  date not null,
  vigente_hasta  date,
  created_at     timestamptz not null default now(),
  check (hasta_hora > desde_hora)
);

create index if not exists contratos_vigentes_idx
  on public.contratos (espacio_id, dia_semana, vigente_desde);

-- La hora de sala, ocupada. Una banda fija y una hora suelta son la misma fila,
-- así el calendario tiene una sola fuente y soltar un martes puntual no toca el
-- contrato.
--
-- **La restricción de exclusión es lo que impide la doble reserva.** Preguntar
-- antes si está libre no alcanza: entre la pregunta y el guardado entra la otra
-- reserva. Acá la segunda es rechazada por la base.
create table if not exists public.reservas (
  id           uuid primary key default gen_random_uuid(),
  espacio_id   uuid not null references public.espacios (id),
  inquilino_id uuid not null references public.inquilinos (id),
  fecha        date not null,
  desde_hora   time not null,
  hasta_hora   time not null,
  franja       tsrange generated always as
                 (tsrange(fecha + desde_hora, fecha + hasta_hora, '[)')) stored,
  origen       text not null check (origen in ('contrato', 'suelta')),
  contrato_id  uuid references public.contratos (id) on delete set null,
  estado       text not null default 'activa'
                 check (estado in ('activa', 'liberada', 'cancelada')),
  importe      numeric(12,2),
  created_at   timestamptz not null default now(),
  check (hasta_hora > desde_hora),
  constraint reservas_sin_solape
    exclude using gist (espacio_id with =, franja with &&) where (estado = 'activa')
);

create index if not exists reservas_espacio_fecha_idx
  on public.reservas (espacio_id, fecha);
create index if not exists reservas_inquilino_fecha_idx
  on public.reservas (inquilino_id, fecha);

-- --------------------------------------------------------------- movimientos

-- La cuenta corriente. El saldo es la suma, y el signo lo pone el tipo y no el
-- número: `importe` siempre es positivo.
--
--   cargo, recargo, ajuste   suman deuda
--   pago, credito            la bajan
--
-- `periodo` es el primer día del mes al que corresponde el movimiento, que no
-- siempre es el mes en que ocurre: un crédito por una hora soltada en octubre
-- descuenta de noviembre.
create table if not exists public.movimientos (
  id           uuid primary key default gen_random_uuid(),
  inquilino_id uuid not null references public.inquilinos (id) on delete cascade,
  tipo         text not null check (tipo in ('cargo', 'pago', 'recargo', 'credito', 'ajuste')),
  fecha        date not null,
  periodo      date,
  importe      numeric(12,2) not null check (importe >= 0),
  reserva_id   uuid references public.reservas (id) on delete set null,
  detalle      text,
  quien        text,
  created_at   timestamptz not null default now()
);

create index if not exists movimientos_cuenta_idx
  on public.movimientos (inquilino_id, periodo, fecha);

-- ------------------------------------------------------------------ permisos

alter table public.espacios        enable row level security;
alter table public.espacio_incluye enable row level security;
alter table public.tarifas         enable row level security;
alter table public.apertura        enable row level security;
alter table public.cierres         enable row level security;
alter table public.inquilinos      enable row level security;
alter table public.contratos       enable row level security;
alter table public.reservas        enable row level security;
alter table public.movimientos     enable row level security;
