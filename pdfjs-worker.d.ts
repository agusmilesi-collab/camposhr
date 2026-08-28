/**
 * El worker de pdfjs no trae tipos: es el archivo que la librería importa a
 * mano en tiempo de ejecución. Lo importamos nosotros para que viaje a la
 * función desplegada (ver `lib/pdf-lector.ts`), y de él solo se usa el objeto
 * entero, que se deja en `globalThis.pdfjsWorker`.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';
