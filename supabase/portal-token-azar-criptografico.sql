-- El enlace de portal sale de un generador criptográfico.
--
-- `token_portal_nuevo()` armaba los 28 caracteres con `random()`, que no es un
-- generador para secretos: con suficientes valores de una misma sesión se puede
-- predecir el siguiente. Ahora salen de `gen_random_bytes` (pgcrypto): 21 bytes
-- en base64 para direcciones son exactamente 28 caracteres, sin relleno. El
-- prefijo `v_` es el de siempre.

create or replace function token_portal_nuevo() returns text
language sql volatile as $$
  select 'v_' || translate(encode(extensions.gen_random_bytes(21), 'base64'), '+/', '-_');
$$;

comment on function token_portal_nuevo() is
  'Un enlace de portal nuevo: v_ y 28 caracteres de gen_random_bytes.';

-- Los enlaces ya repartidos se generaron con el método viejo y se cambian,
-- menos cuatro que quedan como están por decisión de Agustín (14/10/2026):
-- Federada Salud y el grupo Macro Agro (Macro Agro, JHB y Campo Simple). La
-- muestra pública de la página de psicotécnicos tampoco se toca: su enlace
-- está escrito en `lib/portal-ejemplo.ts` a propósito.
--
-- Respaldo de los anteriores en
-- ~/Documents/camposhr-privado/enlaces-portal-antes-de-regenerar-2026-10-14.json
update empresas
set token_portal = token_portal_nuevo()
where token_portal is not null
  and nombre not in (
    'Federada Salud',
    'Macro Agro',
    'JHB',
    'Campo Simple',
    'Vega Materiales (ejemplo)'
  );

select nombre, left(token_portal, 6) as empieza, length(token_portal) as largo
from empresas
order by nombre;
