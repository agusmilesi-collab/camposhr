-- Los pedidos que un cliente no pudo cargar desde su portal.
--
-- Existe porque los registros de Vercel duran una hora en el plan Hobby: el
-- 10/11/2026 Federada no pudo cargar a la mañana y al mediodía ya no quedaba
-- rastro de qué le había pasado. Cada falla queda acá y además le llega un
-- correo a Agustín (`lib/portal-errores.ts`).
--
-- Solo fallas del sistema: un archivo que no subió, un pedido que no se pudo
-- guardar, una respuesta que el navegador no entendió. Lo que el formulario le
-- pide corregir al cliente (falta el apellido, falta un teléfono) no entra.
--
-- `empresa_id` es la del enlace del portal. El token no se guarda: es la llave
-- del portal y no tiene que quedar copiado en otra tabla.
create table if not exists public.portal_errores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  empresa_id uuid references public.empresas(id) on delete set null,
  -- En qué paso: 'subida' (un archivo al almacenamiento), 'lectura' (el lector
  -- de CV), 'pedido' (el alta).
  paso text not null,
  motivo text not null,
  -- Lo que ayuda a entender la falla: nombres y pesos de los archivos, el
  -- código que devolvió el servidor, el navegador.
  detalle jsonb
);

create index if not exists portal_errores_fecha on public.portal_errores (created_at desc);

alter table public.portal_errores enable row level security;
