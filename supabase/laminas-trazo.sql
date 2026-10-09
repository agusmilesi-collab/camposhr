-- Lo que la persona evaluada está señalando sobre la lámina, para verlo en la
-- pantalla de codificación.
--
-- En la encuesta la persona dibuja con el mouse o el dedo dónde vio cada cosa,
-- en su propia máquina. Sin esto la evaluadora lo veía solo si la persona
-- compartía pantalla, y desde un celular en plena videollamada eso casi nunca
-- se puede. Su pantalla manda lo que tiene dibujado varias veces por segundo y
-- la de codificación lo pinta encima de la misma lámina.
--
-- Guarda solo lo último: cada trazo se borra a los cinco segundos, y lo que
-- queda acá es lo que está a la vista en este momento, no un registro.
alter table public.laminas_enlaces add column if not exists trazo jsonb;

notify pgrst, 'reload schema';
