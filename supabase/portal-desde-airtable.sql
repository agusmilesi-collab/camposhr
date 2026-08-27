-- Qué clientes ven su portal servido desde Airtable.
--
-- Mientras las evaluadoras siguen cargando en Airtable y el OS se termina, el
-- cliente tiene que ver lo que ellas actualizan. Con esta marca puesta, los dos
-- enlaces de esa empresa (el que tenía guardado y el que generó la base) sirven
-- el portal de antes; sin ella, sirven el del OS.
--
-- Es por empresa a propósito: los clientes se pasan al OS de a uno, cuando su
-- trabajo ya se lleve ahí, apagando esta marca y sin tocar código.
alter table empresas
  rename column portal_anterior_airtable to portal_desde_airtable;

comment on column empresas.portal_desde_airtable is
  'Servir el portal de este cliente desde Airtable, que es donde se sigue cargando mientras el OS se termina.';

-- Las nueve que venían de Airtable: son las que tienen su trabajo allá.
update empresas
   set portal_desde_airtable = true
 where token_portal_anterior is not null;
