-- La base de conocimiento, servida en tools.
--
-- Los archivos viven en el repo privado `campos-kb`. Acá se copian para poder
-- leerlos desde el navegador: `camposhr-site` es público, así que el material
-- de clientes no puede viajar en él.
--
-- La sincronización es en un solo sentido: del repo a esta tabla
-- (`node scripts/kb-sync.mjs`). Nadie edita acá.
create table if not exists public.kb_docs (
  ruta text primary key,
  clase text not null,           -- tema, ejercicio, armado o suelto
  titulo text not null,
  meta jsonb not null default '{}'::jsonb,
  contenido text not null,
  actualizado_at timestamptz not null default now()
);

create index if not exists kb_docs_clase_idx on public.kb_docs (clase);
