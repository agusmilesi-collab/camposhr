-- Los comprobantes de transferencia que sube el inquilino desde su cuenta.
--
-- **No es un pago.** Es el aviso de que transfirió, con el papel adjunto: el
-- pago lo sigue registrando el equipo cuando ve la plata en la cuenta, y recién
-- ahí baja el saldo. Si subir el archivo bajara la deuda, alcanzaría con subir
-- cualquier imagen para quedar al día.
--
-- El archivo va al bucket privado, en `consultorios/comprobantes/`. Acá queda
-- dónde está, de quién es y a qué mes corresponde.

create table if not exists public.comprobantes_pago (
  id           uuid primary key default gen_random_uuid(),
  inquilino_id uuid not null references public.inquilinos (id) on delete cascade,
  periodo      date not null,
  ruta         text not null,
  nombre       text not null,
  created_at   timestamptz not null default now()
);

create index if not exists comprobantes_pago_inquilino_idx
  on public.comprobantes_pago (inquilino_id, periodo);

alter table public.comprobantes_pago enable row level security;

-- Cuándo se registró el pago que este comprobante avisaba. Mientras está en
-- null, el comprobante sale como aviso en la columna Hoy de Inicio; lo llena
-- la ruta al registrar un pago de esa persona para ese mes.
alter table public.comprobantes_pago add column if not exists registrado_at timestamptz;
