/**
 * Qué archivos se aceptan cuando los sube alguien de afuera: el CV y el
 * descriptivo del puesto, que llegan también desde el portal del cliente.
 *
 * El tipo se decide por la extensión y no por lo que declara el navegador. Si
 * se guardaba con el tipo declarado, un cliente podía subir una página web
 * como "CV", y la evaluadora la abría desde el OS: no corría en el sitio, pero
 * alcanzaba para mostrarle una pantalla de ingreso falsa.
 */

const TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain; charset=utf-8',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** La extensión y el tipo con que se guarda, o null si ese archivo no se acepta. */
export function tipoPermitido(nombre: string): { ext: string; tipo: string } | null {
  const ext = (nombre.includes('.') ? (nombre.split('.').pop() ?? '') : '').toLowerCase();
  const tipo = TIPOS[ext];
  return tipo ? { ext, tipo } : null;
}
