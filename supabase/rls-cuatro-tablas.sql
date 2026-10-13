-- Cuatro tablas que nacieron sin la protección por filas.
--
-- Todas las demás la tienen prendida y sin ninguna política, que es lo que
-- corresponde acá: el sitio lee y escribe con la clave de servicio, que la
-- saltea, y la clave pública no tiene que poder ver nada. Estas cuatro se
-- crearon sin ese renglón y quedaban legibles y escribibles con la clave
-- pública: los contactos de los clientes, la base de las charlas, el análisis
-- discursivo de cada candidato y los perfiles de exigencia.
--
-- Al crear una tabla nueva, este renglón va en el mismo archivo.
alter table public.contactos enable row level security;
alter table public.kb_docs enable row level security;
alter table public.analisis_discursivo enable row level security;
alter table public.exigencias enable row level security;
