-- El espacio de trabajo de las tres: lo pendiente y lo que va a la reunión.
--
-- Una sola tabla para las dos cosas. Un tema de reunión y una tarea son la
-- misma anotación con distinto destino, y separarlas en dos tablas obligaría a
-- moverlas de una a otra cuando algo que se iba a hablar termina siendo algo
-- que alguien hace.
--
--   para_reunion = true   -> aparece en el recuadro de arriba de la home
--   para_reunion = false  -> aparece en la lista de pendientes
--
-- El responsable es el nombre tal como figura en `public.equipo`, y no un
-- vínculo, porque el equipo son tres personas y una tarea sin dueño (null) es
-- un caso válido y frecuente: se anota primero y se reparte después.
--
-- Lo hecho no se borra: se marca. Sirve para saber qué se cerró desde la
-- última reunión, que es media conversación de la reunión siguiente.

create table if not exists public.pendientes (
  id             uuid primary key default gen_random_uuid(),
  texto          text not null check (length(trim(texto)) > 0),
  responsable    text,
  para_reunion   boolean not null default false,
  hecha          boolean not null default false,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index if not exists pendientes_abiertos_idx
  on public.pendientes (para_reunion, hecha, created_at desc);

alter table public.pendientes enable row level security;
