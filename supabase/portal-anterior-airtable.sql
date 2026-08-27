-- Qué empresa sigue leyendo su portal viejo desde Airtable.
--
-- El enlace anterior (`token_portal_anterior`) resuelve a la misma empresa que
-- el de ahora, así que los dos muestran lo que hay en el OS. Con esta marca
-- puesta, el anterior vuelve a servirse desde Airtable: es el portal como estaba
-- antes de la migración, con los datos congelados el día que se dejó de escribir
-- esa base.
--
-- Es por empresa y no una regla general a propósito: los otros ocho clientes que
-- tienen el enlace viejo repartido siguen viendo el trabajo de este mes.
alter table empresas
  add column if not exists portal_anterior_airtable boolean not null default false;

comment on column empresas.portal_anterior_airtable is
  'Con el enlace anterior, servir el portal desde Airtable en vez del OS. Datos congelados al 25/8/2026.';
