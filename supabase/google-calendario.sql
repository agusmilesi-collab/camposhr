-- La entrevista agendada, en el Google Calendar de la evaluadora.
--
-- Cada evaluadora autoriza una vez su cuenta de Google desde Configuración.
-- Desde ahí, agendar una entrevista en el OS crea el evento en su calendario,
-- reprogramarla lo mueve y darla de baja lo borra. Si la entrevista es online,
-- el evento nace con una sala de Meet y el enlace se le manda al candidato.
--
-- `google_calendario` guarda el permiso de cada una. El `refresh_token` es lo
-- que deja escribir en su calendario sin que ella esté: por eso la tabla tiene
-- RLS sin ninguna política, y solo la lee el servidor con la service key.
-- `caida_el` se llena cuando Google rechaza el permiso (lo revocó, o cambió la
-- contraseña): la pantalla lo muestra como "hay que volver a conectar".

create table if not exists public.google_calendario (
  evaluadora_id uuid primary key references public.evaluadoras (id) on delete cascade,
  cuenta        text,
  refresh_token text not null,
  conectado_el  timestamptz not null default now(),
  caida_el      timestamptz
);

alter table public.google_calendario enable row level security;

-- Qué evento le corresponde a cada evaluación.
--
-- `calendario_evaluadora_id` es en el calendario de quién está el evento: si la
-- evaluación cambia de evaluadora, hay que borrarlo de uno y crearlo en otro.
-- **Va sin clave foránea a propósito.** `evaluaciones` ya apunta a
-- `evaluadoras` por `evaluadora_id`, y una segunda clave entre las mismas dos
-- tablas deja ambiguos los embeds de PostgREST: la API contesta 300 y se cae
-- todo lo que une evaluaciones con evaluadoras.
--
-- `calendario_huella` es lo que se le mandó a Google la última vez. Si la
-- evaluación cambia de etapa y el evento quedaría igual, no se llama a nadie.
--
-- `aviso_candidato_fecha` es para qué fecha se le avisó al candidato, igual que
-- `aviso_entrevista_fecha` con el cliente: el correo sale una vez por fecha.

alter table public.evaluaciones add column if not exists calendario_evento_id     text;
alter table public.evaluaciones add column if not exists calendario_evaluadora_id uuid;
alter table public.evaluaciones add column if not exists calendario_huella        text;
alter table public.evaluaciones add column if not exists enlace_meet              text;
alter table public.evaluaciones add column if not exists aviso_candidato_fecha    timestamptz;

-- Las entrevistas que ya estaban agendadas el día que esto se publica quedan
-- anotadas como avisadas: esas personas ya coordinaron con la evaluadora, y sin
-- esto el primer guardado que las toque (corregir un teléfono) les mandaría
-- una confirmación que nadie espera. Si se reprograman, el correo sale.
-- Hay que volver a correrlo al publicar, por las que se agenden entre medio.

update public.evaluaciones
   set aviso_candidato_fecha = fecha_entrevista
 where aviso_candidato_fecha is null
   and fecha_entrevista > now();
