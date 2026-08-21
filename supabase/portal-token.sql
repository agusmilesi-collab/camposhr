-- El enlace del portal de cada cliente, del lado de Supabase.
--
-- Hasta ahora el token vivía solo en Airtable, así que las empresas que ya
-- están migradas no podían tener portal: Distribuidora Andina, que es con la
-- que se prueba todo, aparecía en la lista de clientes con "sin portal".
--
-- Es el secreto que da acceso: quien lo tiene entra. Por eso es único y no se
-- deriva del nombre ni del identificador de la empresa.

alter table empresas add column if not exists token_portal text unique;

comment on column empresas.token_portal is
  'Enlace secreto del portal del cliente. Quien lo tiene entra.';
