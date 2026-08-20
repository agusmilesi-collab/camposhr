-- El pedido, con los campos que ya tiene en Airtable.
--
-- La tabla `Pedidos` de Airtable (tblA3o1XsDXyJXSgF) guarda tres cosas que acá
-- faltaban:
--
-- 1. **El estado real.** Airtable usa "En curso", "Finalizado" y "Cancelado".
--    Acá había un solo valor, "Abierto", y ningún pedido se cerraba nunca: el
--    selector de la tarjeta de alta ofrecía búsquedas terminadas hace meses.
-- 2. **Las listas de familia y seniority.** Estaban escritas a mano y con otros
--    nombres ("Operativo" donde Airtable dice "Junior"), así que las mismas dos
--    columnas no se podían comparar entre los dos lados.
-- 3. **Cómo es el puesto y cómo es el jefe.** Nueve preguntas de tres opciones
--    que describen contra qué se mide a la persona. Es lo que separa un informe
--    del puesto de un informe genérico.
--
-- El Benziger no está en Airtable como campo: allá se sabe que se hizo porque
-- existe el registro en la tabla Benziger. Acá va como `con_benziger` en el
-- pedido, que es donde se decide: es un adicional que el cliente compra para la
-- búsqueda, y lo que define el precio de cada evaluación de ese pedido.
--
-- Lo que sigue faltando: la JD del puesto, que en Airtable es un adjunto.

-- 1. Los valores de estado, como los de Airtable ------------------------------

update public.pedidos set estado = 'En curso' where estado = 'Abierto';

alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos
  add constraint pedidos_estado_check
  check (estado in ('En curso', 'Finalizado', 'Cancelado'));

alter table public.pedidos alter column estado set default 'En curso';

comment on column public.pedidos.estado is
  'En curso, Finalizado o Cancelado. Los mismos de la tabla Pedidos de Airtable.';

-- 2. Familia y seniority, con los nombres de Airtable --------------------------

update public.pedidos set familia = case familia
  when 'Comercial' then 'Comercial / Ventas'
  when 'Administración' then 'Administración / Contable / Finanzas'
  when 'Operaciones' then 'Operaciones / Producción / Logística'
  else familia
end;

update public.pedidos set seniority = case seniority
  when 'Operativo' then 'Junior'
  when 'Semi senior' then 'Semi Senior'
  when 'Gerencia' then 'Dirección'
  else seniority
end;

comment on column public.pedidos.familia is
  'Familia de puesto. Las ocho de Airtable, en lib/pedido-campos.ts.';
comment on column public.pedidos.seniority is
  'Junior, Semi Senior, Senior, Jefatura o Dirección. Los de Airtable.';

-- 3. El Benziger, que es opcional y se compra por pedido -----------------------

alter table public.pedidos
  add column if not exists con_benziger boolean not null default false;

comment on column public.pedidos.con_benziger is
  'Si la búsqueda lleva Benziger. Suma USD 40 por evaluación, al dólar tarjeta.';

-- 4. Contra qué se mide a la persona ------------------------------------------
--
-- Texto y no enum: las opciones las declara la aplicación
-- (`lib/pedido-campos.ts`, generado de Airtable) y una lista cerrada en la base
-- obligaría a un DDL cada vez que allá se agrega una opción.

alter table public.pedidos
  add column if not exists puesto_problemas text,
  add column if not exists puesto_presion text,
  add column if not exists puesto_interaccion text,
  add column if not exists puesto_estabilidad text,
  add column if not exists puesto_contacto_jefe text,
  add column if not exists puesto_innovacion text,
  add column if not exists jefe_estilo text,
  add column if not exists jefe_paciencia text,
  add column if not exists jefe_emociones text;

comment on column public.pedidos.puesto_problemas is 'Airtable: Puesto · Tipo de problemas.';
comment on column public.pedidos.puesto_presion is 'Airtable: Puesto · Presión.';
comment on column public.pedidos.puesto_interaccion is 'Airtable: Puesto · Interacción.';
comment on column public.pedidos.puesto_estabilidad is 'Airtable: Puesto · Estabilidad.';
comment on column public.pedidos.puesto_contacto_jefe is 'Airtable: Puesto · Contacto con el jefe.';
comment on column public.pedidos.puesto_innovacion is 'Airtable: Puesto · Espacio para innovar.';
comment on column public.pedidos.jefe_estilo is 'Airtable: Jefe · Estilo de liderazgo.';
comment on column public.pedidos.jefe_paciencia is 'Airtable: Jefe · Paciencia para el arranque.';
comment on column public.pedidos.jefe_emociones is 'Airtable: Jefe · Comodidad con emociones.';
