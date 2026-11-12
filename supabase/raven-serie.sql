-- Qué Raven se le mandó por enlace: el de 36 láminas o el de 12.
--
-- La evaluadora elige al copiar el enlace desde la hoja de la entrevista. Las
-- sesiones anteriores son todas del de 36, que es el valor por defecto.
--
-- El de 12 corrige sobre su propia clave y guarda los aciertos en
-- `raven.corto` (`supabase/raven-corto.sql`), nunca en `raw`: ese número se
-- lee sobre 36 con su percentil y su rango.

alter table raven_sesiones add column if not exists laminas integer not null default 36
  check (laminas in (12, 36));

comment on column raven_sesiones.laminas is
  'Cuántas láminas tiene el test de esta sesión: 36 (el completo) o 12 (la serie corta).';
