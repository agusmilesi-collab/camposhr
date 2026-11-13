-- La prioridad del pedido, que elige quien lo deja: Alta, Media o Baja.
alter table public.tickets
  add column if not exists prioridad text not null default 'Media';

alter table public.tickets drop constraint if exists tickets_prioridad_check;
alter table public.tickets
  add constraint tickets_prioridad_check check (prioridad in ('Alta', 'Media', 'Baja'));
