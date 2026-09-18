-- La charla de John Deere del 24 de septiembre de 2026.
--
-- Es una charla suelta y no un ciclo de cinco encuentros, pero el modelo de
-- corridas cuelga de un ciclo: acá "Conversaciones difíciles" es un ciclo de
-- una sola charla. Eso le da a John Deere su propia corrida, con su clave de
-- control y sus asistentes, sin mezclarse con la de Pla.
--
-- La empresa ya existía (slug `john-deere`), así que solo se crean el ciclo y
-- la corrida. Las actividades del encuentro todavía no están construidas: la
-- corrida nace en reposo y el QR ya sirve para que la sala se registre.

begin;

insert into public.ciclos (nombre)
values ('Conversaciones difíciles')
on conflict (nombre) do nothing;

insert into public.corridas (empresa_id, ciclo_id, clave_control)
select e.id,
       c.id,
       -- La clave real no se versiona: este repositorio es público y con ella
       -- se abre el panel de control del encuentro. La que se usó se generó
       -- con `python3 -c "import secrets;print(secrets.token_hex(12))"` y está
       -- en la fila de la corrida; el enlace con la clave puesta sale del hub
       -- de la charla, en Presentaciones.
       :'clave_control'
  from public.empresas e
  cross join public.ciclos c
 where e.slug = 'john-deere'
   and c.nombre = 'Conversaciones difíciles'
   and not exists (
     select 1 from public.corridas x where x.empresa_id = e.id and x.activa
   );

commit;
