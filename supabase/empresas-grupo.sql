-- Empresas del mismo dueño que piden por una sola puerta.
--
-- Macro Agro pide candidatos para tres CUIT (el propio, JHB y Campo Simple):
-- las mismas dos personas cargan los pedidos de las tres, y cada una factura
-- lo suyo. Cada CUIT sigue siendo una empresa, que es lo que mira la
-- facturación; `grupo_id` dice a cuál pertenece. La empresa que encabeza el
-- grupo lo lleva en null, y es donde se cargan las personas que piden.
--
-- Sin clave foránea a propósito: el dato se valida en el código. Una relación
-- de más entre tablas ya dejó ambiguas las consultas una vez y tiró dos
-- pantallas del sitio publicado.

alter table public.empresas add column if not exists grupo_id uuid;
alter table public.empresas drop constraint if exists empresas_grupo_no_propio;
alter table public.empresas add constraint empresas_grupo_no_propio check (grupo_id is null or grupo_id <> id);
create index if not exists empresas_grupo_idx on public.empresas (grupo_id) where grupo_id is not null;
