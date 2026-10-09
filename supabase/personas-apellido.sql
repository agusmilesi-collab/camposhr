-- El nombre y el apellido de cada persona, por separado.
--
-- `personas.nombre` sigue guardando el nombre completo tal como se muestra
-- ("Abril Molinari"): lo leen el tablero, la ficha, el informe, los correos y
-- las facturas, y ninguno cambia. Las dos columnas nuevas son para lo que
-- necesita cada parte: el saludo ("Hola Abril") y el contacto de Google, que
-- tiene nombre y apellido en campos distintos.
--
-- Se cargan desde los formularios, que piden los dos datos. Las personas de
-- antes quedan con las dos columnas vacías y se leen con la regla de
-- `partesDelNombre` (`lib/personas.ts`) hasta que alguien las edite.
alter table public.personas
  add column if not exists nombre_pila text,
  add column if not exists apellido text;
