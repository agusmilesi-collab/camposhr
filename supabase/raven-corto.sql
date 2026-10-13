-- El Raven de 12 láminas, que se tomó a perfiles comerciales y operativos
-- entre mayo y octubre de 2026.
--
-- No se puede guardar en `raw`: ese número se lee sobre 36 láminas, con su
-- percentil y su rango, y cuatro personas tenían 11 de 12 cargado ahí y
-- figuraban como "Rango IV · Inferior al término medio".
--
-- Va en su propia columna y entra al velocímetro por escalón, sin percentil ni
-- rango. Ya no se toma (decisión del equipo, octubre de 2026), así que no tiene
-- pantalla de carga: es para los que ya lo rindieron.

alter table raven add column if not exists corto integer
  check (corto between 0 and 12);

comment on column raven.corto is
  'Aciertos sobre las 12 láminas de la serie corta. Null si rindió el de 36.';
