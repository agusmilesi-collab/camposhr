-- Cuándo vio quien pidió el ticket que se cerró.
--
-- Al cerrarse (Hecho o Descartado) le aparece una tarjeta en Hoy, en Inicio,
-- hasta que la abre. `visto_el` null con el ticket cerrado es "todavía no lo
-- vio". El trigger lo vuelve a null cada vez que el ticket pasa a cerrado,
-- también cuando lo cierra un agente escribiendo directo en la base.
alter table public.tickets add column if not exists visto_el timestamptz;

create or replace function public.tickets_cierre_sin_ver() returns trigger
language plpgsql as $$
begin
  if new.estado in ('Hecho', 'Descartado')
     and (old.estado is distinct from new.estado) then
    new.visto_el := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_cierre_sin_ver on public.tickets;
create trigger tickets_cierre_sin_ver
  before update on public.tickets
  for each row execute function public.tickets_cierre_sin_ver();

-- Lo cerrado antes de hoy ya se sabe: no se avisa de nuevo. El 2 se cerró hoy
-- y queda sin ver.
update public.tickets set visto_el = now()
where estado in ('Hecho', 'Descartado') and numero <> 2 and visto_el is null;
