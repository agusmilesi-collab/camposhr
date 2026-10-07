-- Qué correos recibe cada contacto del cliente, y lo que hace falta para que
-- cada aviso salga una sola vez.
--
-- Un contacto tilda qué recibe: la orden de compra, la entrevista agendada, el
-- informe listo, y la factura con su recibo de pago (`facturacion`, que ya
-- existía). Por defecto recibe lo de los candidatos que pidió él;
-- `recibe_todo` le suma lo que piden los demás de su empresa. Así compras
-- recibe todas las facturas sin pedir nada, y recursos humanos pide y se
-- entera sin recibir facturas.

alter table public.contactos add column if not exists recibe_orden      boolean;
alter table public.contactos add column if not exists recibe_entrevista boolean;
alter table public.contactos add column if not exists recibe_informe    boolean;
alter table public.contactos add column if not exists recibe_todo       boolean;

-- Los que ya estaban, una sola vez (las columnas nacen en null). Quien pide
-- recibe sus tres avisos y su factura. "Recibe la factura" quería decir todas
-- las de la empresa, así que esos quedan con `recibe_todo`.
update public.contactos set
  recibe_todo       = facturacion,
  recibe_orden      = pide,
  recibe_entrevista = pide,
  recibe_informe    = pide,
  facturacion       = (facturacion or pide)
where recibe_orden is null;

alter table public.contactos alter column recibe_orden      set default true;
alter table public.contactos alter column recibe_entrevista set default true;
alter table public.contactos alter column recibe_informe    set default true;
alter table public.contactos alter column recibe_todo       set default false;
alter table public.contactos alter column recibe_orden      set not null;
alter table public.contactos alter column recibe_entrevista set not null;
alter table public.contactos alter column recibe_informe    set not null;
alter table public.contactos alter column recibe_todo       set not null;

-- Para qué fecha se avisó la entrevista: si cambia, es una reprogramación y se
-- avisa de nuevo; si es la misma, no.
alter table public.evaluaciones add column if not exists aviso_entrevista_fecha timestamptz;
-- Cuándo se avisó que el informe está en el portal. Se avisa una vez.
alter table public.evaluaciones add column if not exists aviso_informe_at timestamptz;
-- Cuándo salió por correo el recibo de pago. Sale una vez.
alter table public.facturas add column if not exists recibo_enviado_at timestamptz;

-- Lo que ya estaba agendado o entregado antes de que existieran los avisos
-- queda como avisado: si no, tocar una evaluación vieja le manda al cliente un
-- correo por algo que pasó hace semanas.
update public.evaluaciones set aviso_entrevista_fecha = fecha_entrevista
where aviso_entrevista_fecha is null and fecha_entrevista is not null
  and estado in ('Por entrevistar', 'Por analizar', 'Entregado', 'Seguimiento')
  and created_at < '2026-10-08';
update public.evaluaciones set aviso_informe_at = coalesce(fecha_entrega, now())
where aviso_informe_at is null and estado in ('Entregado', 'Seguimiento')
  and created_at < '2026-10-08';
update public.facturas set recibo_enviado_at = cobrada_at
where recibo_enviado_at is null and cobrada_at is not null
  and created_at < '2026-10-08';
