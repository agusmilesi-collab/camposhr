-- 15/10/2026. El índice único del correo de los inquilinos contaba el vacío
-- como un valor: con dos inquilinos sin correo, guardar la ficha del segundo
-- daba "duplicate key" (le pasó a Camila Bazan al darla de baja). El correo
-- vacío pasa a null y el índice deja de mirar los null.
update public.inquilinos set correo = null where correo = '';

drop index if exists public.inquilinos_correo_idx;
create unique index inquilinos_correo_idx
  on public.inquilinos (lower(correo))
  where correo is not null;
