-- Los pedidos de cambio del sistema que dejan las evaluadoras.
--
-- Llegaban por WhatsApp, mezclados con el resto de la conversación, y se
-- perdían. Cada uno es una fila con número correlativo, quién lo pidió, qué
-- pide y en qué estado está. Lo carga quien está trabajando en el OS
-- (`lib/identidad.ts`) y lo resuelve Agustín.
create table if not exists public.tickets (
  numero         bigint generated always as identity primary key,
  pide           text not null,
  texto          text not null check (length(trim(texto)) > 0),
  donde          text,
  estado         text not null default 'Nuevo'
                 check (estado in ('Nuevo', 'En curso', 'Hecho', 'Descartado')),
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index if not exists tickets_estado_idx on public.tickets (estado, numero desc);

alter table public.tickets enable row level security;

comment on table public.tickets is
  'Pedidos de cambio del OS que dejan las evaluadoras. Se leen y escriben desde /os/tickets.';
