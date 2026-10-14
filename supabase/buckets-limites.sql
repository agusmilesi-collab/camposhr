-- Tope de tamaño y de tipo en los dos buckets.
--
-- Hoy todo se sube desde el servidor, que ya revisa tipo y tamaño antes de
-- mandar. Este tope es la segunda barrera: si una ruta nueva se olvida de
-- revisar, el bucket rechaza igual lo que no corresponde.
--
-- psicotecnicos: el archivo más grande que entra es la grabación del discurso
-- (25 MB). Los tipos son los de CV y descriptivo (lib/archivos-permitidos.ts),
-- comprobantes, gráfico, láminas, audio, facturas, datos del Benziger, y los
-- documentos de portal y cotizaciones (html).
update storage.buckets set
  file_size_limit = 30 * 1024 * 1024,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/plain',
    'text/html',
    'image/*',
    'audio/*'
  ]
where id = 'psicotecnicos';

-- selfies: solo fotos, con el mismo tope que el registro del ciclo (3 MB) y
-- un margen.
update storage.buckets set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'selfies';

select id, file_size_limit, allowed_mime_types from storage.buckets order by id;
