-- El candidato, agendado en los contactos de Google de la evaluadora.
--
-- Al tocar el WhatsApp de una tarjeta de Por citar, el OS crea el contacto en
-- la cuenta de Google de la evaluadora de esa evaluación: nombre y apellido,
-- teléfono y "Candidato" de la empresa que lo pidió. Así WhatsApp le muestra
-- quién es en lugar de un número.
--
-- `google_calendario.contactos` dice si esa conexión dio el permiso de
-- contactos: las que se conectaron antes de que existiera no lo tienen y hay
-- que volver a conectarlas.
alter table public.google_calendario
  add column if not exists contactos boolean not null default false;

-- Qué contacto se creó para cada persona en la cuenta de cada evaluadora, para
-- no crearlo dos veces. **Sin claves foráneas a propósito**: una tabla más que
-- una personas con evaluadoras le abre otro camino a los embeds de PostgREST.
-- RLS sin políticas: solo la lee el servidor con la service key.
create table if not exists public.google_contactos (
  evaluadora_id uuid not null,
  persona_id    uuid not null,
  recurso       text not null,
  creado_el     timestamptz not null default now(),
  primary key (evaluadora_id, persona_id)
);

alter table public.google_contactos enable row level security;
