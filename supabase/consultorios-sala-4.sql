-- El consultorio 4.
--
-- Entra en la categoría A, la de los consultorios 1 y 3, que es la escala
-- estándar: no se declaró que tuviera equipamiento propio como el 2. Si va con
-- precio aparte, se le crea su categoría y se cambia acá, porque la categoría
-- decide el precio de todo lo que se reserve en esa sala y por eso no se edita
-- desde la pantalla.
--
-- El orden lo deja antes del SUM: los consultorios van numerados y el SUM al
-- final, que es como se lee la fila de encabezados del calendario.

insert into public.espacios (nombre, tipo, categoria, orden)
values ('Consultorio 4', 'consultorio', 'A', 4)
on conflict (nombre) do nothing;

update public.espacios set orden = 5 where nombre = 'SUM';

-- Mismo horario que el resto: de lunes a viernes, de 8 a 20.
insert into public.apertura (espacio_id, dia_semana, desde_hora, hasta_hora)
select e.id, d.dia, time '08:00', time '20:00'
  from public.espacios e
 cross join generate_series(0, 4) as d(dia)
 where e.nombre = 'Consultorio 4'
on conflict (espacio_id, dia_semana) do nothing;

insert into public.espacio_incluye (espacio_id, texto, orden)
select e.id, 'Timbre independiente', 1
  from public.espacios e
 where e.nombre = 'Consultorio 4';

select nombre, categoria, orden from public.espacios order by orden;
