-- El cruce de cuadrantes de la charla 3, en la placa de consultar una decisión.
--
-- La placa pide elegir a un par con un estilo distinto y consultarle una
-- decisión. Elegirlo a ojo falla siempre igual: la gente se junta con quien ya
-- se lleva bien, que suele pensar parecido, y los últimos en decidirse se
-- quedan sin nadie. Con el cuestionario ya respondido en esa misma charla, el
-- reparto lo hace el sistema y cada teléfono recibe a quién buscar.
--
-- El tipo 'cruce' no se responde: el servidor escribe una fila por persona al
-- abrir la actividad, con los ids de su grupo. Ver lib/cruce.ts.
alter table public.actividades drop constraint if exists actividades_tipo_check;
alter table public.actividades add constraint actividades_tipo_check
  check (tipo in ('palabra','opcion','escala','texto','marcas','enlace','cuestionario','cruce'));

-- La respuesta al cuestionario pasa a saber de quién es.
--
-- Antes se ataba por nombre y apellido escritos, y con eso el cruce depende de
-- que estén tipeados igual en los dos lados: "Agustin" contra "Agustín" deja a
-- alguien sin pareja en el medio de la sala.
alter table public.respuestas
  add column if not exists asistente_id uuid references public.asistentes(id) on delete set null;
create index if not exists respuestas_asistente on public.respuestas (asistente_id);

update public.respuestas r
   set asistente_id = s.id
  from public.asistentes s
 where r.asistente_id is null
   and r.corrida_id is not null
   and s.corrida_id = r.corrida_id
   and lower(s.nombre) = lower(r.nombre)
   and lower(s.apellido) = lower(coalesce(r.apellido, ''));

-- Charla 3 · PLACA 17. Va segunda: el cuestionario de la placa 3 es el que
-- produce los cuadrantes con los que se reparte esta. El enunciado es lo que se
-- lee al pie del teléfono, debajo de la cara de la persona que le tocó.
insert into actividades (clave, charla, orden, tipo, titulo, enunciado, opciones, ciclo_id)
values
  ('c3-consulta', 3, 2, 'cruce',
   '¿A quién le consultás?',
   'Consultale una decisión que tenés que tomar y escuchá cómo la ve.',
   '[]'::jsonb,
   (select id from ciclos limit 1))
on conflict (ciclo_id, clave) do nothing;

select clave, charla, orden, tipo, titulo from actividades where charla = 3 order by orden;
