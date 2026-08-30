-- La grabación de los cinco minutos de discurso libre.
--
-- Es el material del que sale el estrato de la persona: se pide en la
-- entrevista, se guarda acá y se escucha después, al codificar. El archivo vive
-- en el bucket `psicotecnicos`, en `discurso/<evaluacion>.<extension>`, como el
-- resto de lo que sube la evaluadora.
alter table analisis_discursivo
  add column if not exists audio_path text,
  add column if not exists audio_nombre text,
  add column if not exists audio_bytes bigint;

comment on column analisis_discursivo.audio_path is
  'Ruta en el bucket psicotecnicos de la grabación de los cinco minutos de discurso.';
comment on column analisis_discursivo.audio_nombre is
  'El nombre con el que llegó el archivo, para reconocerlo.';
comment on column analisis_discursivo.audio_bytes is
  'Cuánto pesa, para avisar cuando una grabación sin comprimir se fue de tamaño.';
