-- La objeción con la que se perdió una oportunidad.
--
-- El motivo se escribía a mano y cada perdida decía lo suyo, así que revisar el
-- mes no dejaba ver qué se repite. Estas cinco son las categorías con las que se
-- clasifica una perdida en venta consultiva: qué le faltó al otro para avanzar.
-- El texto libre queda al lado, en `motivo`, para el detalle del caso.
alter table cotizaciones
  add column if not exists objecion text;

alter table cotizaciones
  drop constraint if exists cotizaciones_objecion_valida;

alter table cotizaciones
  add constraint cotizaciones_objecion_valida
  check (objecion is null or objecion in ('Valor', 'Ajuste', 'Timing', 'Riesgo', 'Capacidad'));

comment on column cotizaciones.objecion is
  'Por qué no avanzó: Valor, Ajuste, Timing, Riesgo o Capacidad. Solo en las perdidas.';
