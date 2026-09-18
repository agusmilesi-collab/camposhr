-- Los campos que cada ciclo le pide a quien se registra.
--
-- Hasta ahora el registro era fijo: nombre, apellido y selfie. John Deere
-- necesita además el área, el salary grade y hace cuánto tiene gente a cargo,
-- porque con eso el sistema arma los tríos del role play cruzando sectores y
-- niveles, y decide qué pregunta le toca a cada uno en el bloque final.
--
-- Van declarados por ciclo y no escritos en el código: el próximo cliente pide
-- otros tres y eso no puede ser un despliegue. Cada campo es
--   { clave, etiqueta, opciones: [...] }
-- y se responde con un toque, sin teclado, que es lo único que entra en el
-- minuto del pico de registro.
--
-- Las respuestas viven en `asistentes.datos`, un objeto con la clave de cada
-- campo. En columnas propias habría una por cliente y la tabla sería una
-- colección de columnas vacías.

begin;

alter table public.ciclos
  add column if not exists campos_registro jsonb not null default '[]'::jsonb;

alter table public.asistentes
  add column if not exists datos jsonb not null default '{}'::jsonb;

update public.ciclos
   set campos_registro = '[
     {
       "clave": "area",
       "etiqueta": "¿En qué área estás?",
       "opciones": ["Fábrica", "Branch", "JDF", "Finanzas", "IT", "Share"]
     },
     {
       "clave": "grado",
       "etiqueta": "¿Cuál es tu salary grade?",
       "opciones": ["8", "9", "10 o más"]
     },
     {
       "clave": "rol",
       "etiqueta": "¿Hace cuánto tenés gente a cargo?",
       "opciones": ["Más de un año", "Menos de un año"]
     }
   ]'::jsonb
 where nombre = 'Conversaciones difíciles';

commit;
