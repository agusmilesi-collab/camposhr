-- El perfil Benziger puede tener dos cuadrantes, y no siempre pesan igual.
--
-- `cuadrante_preferente` ya era una lista, así que dos entraban desde el
-- principio; lo que no se podía decir es cómo se relacionan. Una persona puede
-- ser Frontal Izquierdo con algo de Basal Izquierdo, o las dos cosas con la
-- misma fuerza, y son dos lecturas distintas del mismo par: en la primera hay
-- un cuadrante que manda y en la segunda no.
--
-- El orden de la lista lleva la jerarquía (el primero es el que manda) y esta
-- columna dice si esa jerarquía existe. En false, el primero manda; en true,
-- los dos valen lo mismo y el orden no significa nada.
--
-- Por defecto false, que es lo que vale para todo lo ya cargado: hasta ahora
-- solo se podía elegir uno.
alter table public.benziger
  add column if not exists cuadrantes_parejos boolean not null default false;

comment on column public.benziger.cuadrantes_parejos is
  'true: los cuadrantes de cuadrante_preferente pesan lo mismo. false: manda el primero.';
