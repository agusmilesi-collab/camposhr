-- La confirmación de asistencia del candidato a una entrevista online.
--
-- El correo que le manda el sistema lleva un botón "Confirmar asistencia" que
-- abre camposhr.com/confirmar/<token>. El token es propio de la evaluación y
-- no su identificador, que se ve en las direcciones del OS.
--
-- Son dos columnas sueltas, sin clave foránea: no tocan los embeds.
alter table evaluaciones
  add column if not exists confirmar_token text unique,
  add column if not exists asistencia_confirmada_el timestamptz;
