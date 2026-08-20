-- Los campos de `evaluaciones` pasan a llamarse como en Airtable.
--
-- Mientras dure la migración conviven los dos lados, y dos vocabularios para la
-- misma cosa obligan a traducir en cada consulta. Airtable es la referencia
-- porque es donde está hoy el trabajo real.
--
-- Qué cambia, y de dónde sale cada nombre (tabla Individuo en Airtable):
--
--   etapa                -> estado                            ("Estado")
--   contacto             -> mensaje                           ("Mensaje")
--   grafico_administrado -> grafico_2_personas_administrado    ("Gráfico 2 personas administrado")
--
-- Las demás columnas ya coincidían: nombre, email, telefono, modalidad,
-- fecha_entrevista, fecha_entrega, bender_administrado, recomendacion.
--
-- Renombrar una columna en Postgres no toca los datos ni las claves foráneas.
-- Las restricciones y el índice se renombran acá también para que su nombre no
-- quede hablando de una columna que ya no existe.
--
-- Va en una transacción: si algo falla, no queda la tabla a medio renombrar.
--
-- IMPORTANTE: la aplicación deja de leer estas columnas hasta que se despliegue
-- el código que usa los nombres nuevos. Correr los dos juntos.

begin;

alter table public.evaluaciones rename column etapa to estado;
alter table public.evaluaciones rename column contacto to mensaje;
alter table public.evaluaciones
  rename column grafico_administrado to grafico_2_personas_administrado;

alter table public.evaluaciones
  rename constraint evaluaciones_etapa_check to evaluaciones_estado_check;
alter table public.evaluaciones
  rename constraint evaluaciones_contacto_check to evaluaciones_mensaje_check;

alter index public.evaluaciones_etapa_idx rename to evaluaciones_estado_idx;

commit;
