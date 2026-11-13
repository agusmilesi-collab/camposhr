-- La conversación de cada ticket: quién escribió, qué y cuándo.
--
-- Una sola respuesta no alcanzaba: quien resuelve el ticket pregunta (y el
-- ticket queda Bloqueado), la evaluadora contesta, y la respuesta pisaba a la
-- anterior sin dejar rastro de quién dijo qué. Las respuestas que había en
-- `tickets.respuesta` pasan a ser el primer mensaje, firmado "Agente".
create table if not exists public.ticket_mensajes (
  id         uuid primary key default gen_random_uuid(),
  numero     bigint not null references public.tickets (numero) on delete cascade,
  autor      text not null,
  texto      text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists ticket_mensajes_numero_idx on public.ticket_mensajes (numero, created_at);

alter table public.ticket_mensajes enable row level security;

insert into public.ticket_mensajes (numero, autor, texto, created_at)
select t.numero, 'Agente', t.respuesta, t.actualizado_at
from public.tickets t
where t.respuesta is not null and trim(t.respuesta) <> ''
  and not exists (select 1 from public.ticket_mensajes m where m.numero = t.numero);

comment on table public.ticket_mensajes is
  'Conversación de cada ticket. Reemplaza a tickets.respuesta, que queda sin uso.';
