-- Lo que la persona dibujó en el Bender.
--
-- Son nueve hojas, una por lámina, que llegan como nueve fotos de teléfono por
-- WhatsApp. Se guardan como una sola imagen: nueve archivos sueltos hay que
-- volver a ordenarlos cada vez que se abre la evaluación, y el orden de las
-- láminas es parte de lo que se lee.
--
-- El armado y el achicado pasan en el navegador de la evaluadora, antes de
-- subir. Nueve fotos de teléfono son unos treinta megas: comprimidas y unidas,
-- lo que viaja es una sola imagen de menos de dos.

alter table evaluaciones add column if not exists bender_path text;
alter table evaluaciones add column if not exists bender_nombre text;

comment on column evaluaciones.bender_path is
  'La hoja del Bender en el bucket privado: las nueve láminas en una imagen.';
comment on column evaluaciones.bender_nombre is
  'Cuántas fotos se unieron y cuándo, para saber si están las nueve.';
