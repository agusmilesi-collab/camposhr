-- El correo del inquilino deja de ser obligatorio.
--
-- Hay gente que alquila y no va a entrar nunca al sistema: las psicólogas le
-- reservan la hora desde el calendario y le llevan la cuenta igual. Pedirle un
-- correo para poder cargarla obligaba a inventar uno.
--
-- El índice único sigue en pie sobre `lower(correo)`, y en Postgres varios nulos
-- no chocan entre sí, así que pueden convivir muchas personas sin correo y
-- ninguna repetirlo.

alter table public.inquilinos alter column correo drop not null;

comment on column public.inquilinos.correo is
  'Nulo mientras la persona no tenga acceso al sistema. Es el usuario con el que entra.';
