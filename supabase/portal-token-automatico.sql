-- El portal de un cliente nace con el cliente.
--
-- Hasta ahora el token se cargaba a mano, así que un cliente nuevo quedaba sin
-- portal hasta que alguien se acordara: la pantalla de Clientes le mostraba
-- "sin portal" y no había forma de dárselo desde el OS.
--
-- Va como valor por defecto de la columna y no en el código porque hay dos
-- caminos de alta, la pantalla de Clientes y el alta rápida al cargar un pedido
-- de un cliente que todavía no existe. En la base, los dos lo obtienen igual, y
-- cualquier alta que se agregue después también.
--
-- El token es el secreto que da acceso: quien lo tiene entra. Por eso son 28
-- caracteres al azar y no algo derivado del nombre o del identificador, que se
-- podrían adivinar. El prefijo `v_` es el que ya usan los enlaces en circulación.

create or replace function token_portal_nuevo() returns text
language sql volatile as $$
  select 'v_' || string_agg(
    substr(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      1 + floor(random() * 62)::int,
      1
    ),
    ''
  )
  from generate_series(1, 28);
$$;

comment on function token_portal_nuevo() is
  'Un enlace de portal nuevo. 28 caracteres al azar detrás de v_.';

alter table empresas alter column token_portal set default token_portal_nuevo();

-- Los clientes que ya estaban cargados también tienen el suyo. Tener el enlace
-- no muestra nada de más: el portal enseña los pedidos de esa empresa, y sin
-- pedidos está vacío. Se comparte recién cuando alguien lo copia.
update empresas set token_portal = token_portal_nuevo() where token_portal is null;
