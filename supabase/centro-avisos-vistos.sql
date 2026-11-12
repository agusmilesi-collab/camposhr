-- Los avisos de Inicio que el inquilino ya dio por vistos.
--
-- "Se emitió tu factura" y "Registramos tu pago" se quedan siete días en Hoy.
-- Con el botón "Ok" la persona los saca antes. La clave es la misma de la
-- tarjeta (`f-<factura>`, `p-<movimiento>`): el aviso se sigue leyendo de lo
-- guardado y esta tabla solo dice cuáles no mostrar.
-- Cae en cascada con el inquilino: no es un dato que tenga sentido sin él.
create table if not exists public.centro_avisos_vistos (
  inquilino_id  uuid not null references public.inquilinos (id) on delete cascade,
  clave         text not null check (clave ~ '^[fp]-[0-9a-f-]{36}$'),
  visto_at      timestamptz not null default now(),
  primary key (inquilino_id, clave)
);
alter table public.centro_avisos_vistos enable row level security;
