-- Los objetos en que se separó una respuesta del Rorschach, cada uno con su
-- área, su calidad y sus contenidos (21/10/2026). La respuesta guarda la
-- localización general; esto es el detalle que se ve en el desplegable.
alter table public.rorschach_respuestas add column if not exists objetos jsonb;
