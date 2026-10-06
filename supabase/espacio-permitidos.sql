-- Quién puede alquilar cada sala.
--
-- Null significa todos, que es lo normal. Con una lista, la sala la ven y la
-- reservan solo esos inquilinos: es el caso de un consultorio que su dueña
-- alquila a quien ella elige. Para el equipo no cambia nada: en el calendario
-- del OS la sala está siempre, y desde ahí se le puede reservar a cualquiera.
--
-- Es una lista en la sala y no una tabla aparte porque son pocas personas y se
-- lee siempre junto con la sala.
alter table public.espacios add column if not exists permitidos uuid[];
