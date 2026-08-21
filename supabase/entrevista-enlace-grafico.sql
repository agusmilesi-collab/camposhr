-- La hoja de la entrevista guarda dos cosas más.
--
-- El enlace de la videollamada, para las entrevistas online: hoy vive en el
-- calendario o en el chat donde se acordó, así que a la hora de entrar hay que
-- ir a buscarlo a otro lado. Es texto y no una dirección validada porque cada
-- herramienta arma la suya y la lista cambia sola.
--
-- El gráfico de dos personas, que se toma en papel: la foto o el escaneo del
-- dibujo. El archivo va al bucket privado (`psicotecnicos/grafico/<id>`), y acá
-- queda dónde está y cómo se llamaba el archivo, que es lo que después deja ver
-- si el que está cargado es el que corresponde.

alter table evaluaciones
  add column if not exists enlace_entrevista text,
  add column if not exists grafico_2_personas_path text,
  add column if not exists grafico_2_personas_nombre text;

comment on column evaluaciones.enlace_entrevista is
  'Enlace de la videollamada, para las entrevistas online.';
comment on column evaluaciones.grafico_2_personas_path is
  'Ruta del dibujo en el bucket privado psicotecnicos.';
comment on column evaluaciones.grafico_2_personas_nombre is
  'Nombre del archivo que se subió, para reconocerlo.';
