import 'server-only';

/**
 * El lector de PDF, listo para correr en la función desplegada.
 *
 * pdfjs no lee el archivo en el hilo principal: levanta un worker. En Node no
 * hay `Worker` de navegador, así que arma uno falso importando
 * `pdf.worker.mjs` **con la ruta armada en una cadena**, en tiempo de
 * ejecución. Un import así no lo ve ningún empaquetador: el rastreo de Next no
 * sube ese archivo a la función y la lectura muere con "Setting up fake worker
 * failed". En el servidor de desarrollo anda porque el archivo está en
 * `node_modules`, y por eso las pruebas del lector pasaban mientras producción
 * fallaba.
 *
 * La salida es importarlo nosotros, con un import que sí se ve, y dejarlo en
 * `globalThis.pdfjsWorker`: pdfjs mira ahí primero (`#mainThreadWorkerMessageHandler`)
 * y, si lo encuentra, no busca ningún archivo.
 *
 * Lo usan los tres lugares que leen un PDF: el informe del Benziger y el CV,
 * desde el portal y desde el OS.
 */

type GetDocument = typeof import('pdfjs-dist/legacy/build/pdf.mjs')['getDocument'];

let listo: Promise<GetDocument> | null = null;

export function lectorDePdf(): Promise<GetDocument> {
  listo ??= (async () => {
    const [pdf, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ]);
    // Antes de la primera lectura: pdfjs lo consulta al crear el worker.
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return pdf.getDocument;
  })();
  return listo;
}
