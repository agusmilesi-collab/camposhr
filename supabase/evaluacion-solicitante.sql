-- Quién de la empresa cargó a cada candidato (3/10/2026).
--
-- El pedido ya guarda quién lo pidió (pedidos.solicitante_id), pero un pedido
-- lo arranca una persona y después le suman candidatos otras: hay clientes
-- donde lo abre una persona y los candidatos los cargan dos o tres más. Lo
-- que se elige en "Enviar como" al sumar un candidato a un pedido que ya existe
-- no quedaba guardado en ningún lado.
--
-- Null significa "el del pedido": las evaluaciones viejas no se tocan y el
-- informe sigue nombrando a quien pidió la búsqueda.

alter table public.evaluaciones
  add column if not exists solicitante_id uuid
  references public.contactos (id) on delete set null;

create index if not exists evaluaciones_solicitante_id_idx
  on public.evaluaciones (solicitante_id);

-- Que la API vea la columna sin esperar a que recargue sola.
notify pgrst, 'reload schema';
