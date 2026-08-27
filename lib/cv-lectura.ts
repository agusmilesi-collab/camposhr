import 'server-only';

/**
 * Lo que se puede leer de un CV, para llenar la fila del candidato.
 *
 * Nació en el portal del cliente, que venía de mandar los CV por WhatsApp sin
 * escribir nada: pedirle que transcriba el nombre y el teléfono que ya están
 * adentro del archivo era la fricción que había que sacar. Las evaluadoras
 * cargan candidatos igual, desde el tablero de Entrevistas, así que el lector
 * es el mismo para los dos lados y vive acá y no en una ruta.
 *
 * **Se lee del lado del servidor**, con el mismo camino que usa el lector del
 * Benziger: en el navegador habría que servir el worker de pdfjs y bajar un
 * megabyte por visita.
 *
 * **No guarda nada.** Lee el archivo, devuelve lo que encontró y lo suelta. El
 * CV se sube cuando se manda el alta, no acá.
 *
 * **Y acierta casi siempre, no siempre**: lo que devuelve se escribe en campos
 * que se pueden corregir. Un CV ilegible vuelve vacío y no puede dejar a nadie
 * sin poder cargar a esa persona.
 */

/** Hasta acá se leen archivos de una vez. Más que eso no es una tanda. */
export const MAXIMO_CV = 12;
export const MAX_BYTES_CV = 10 * 1024 * 1024;

export type LeidoDeCv = { nombre: string; mail: string; telefono: string };

async function textoDe(bytes: Uint8Array): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Una copia con su propio búfer: el lector le pasa los bytes a su hilo
  // interno y no puede transferir el que llega del formulario.
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const doc = await getDocument({ data: copia, isEvalSupported: false }).promise;
  const p = await doc.getPage(1);
  const { items } = await p.getTextContent();
  return (items as { str?: string }[])
    .map((i) => (typeof i.str === 'string' ? i.str.trim() : ''))
    .filter(Boolean);
}

/**
 * De dónde sale cada dato.
 *
 * El mail y el teléfono están escritos como tales y se encuentran con su forma.
 * El nombre no tiene forma propia: se toma la primera línea corta de dos a
 * cuatro palabras que empiezan en mayúscula, que es como se encabeza un CV, y
 * se descartan las que son claramente otra cosa.
 */
const NO_ES_NOMBRE =
  /curriculum|currículum|vitae|datos|personales|resumen|perfil|profesional|contacto|experiencia|educaci/i;

export function leer(lineas: string[]): LeidoDeCv {
  const todo = lineas.join(' ');
  const mail = todo.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? '';
  const telefono =
    todo.match(/(?:\+?54[\s.-]?)?(?:9[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2}\d{3,4}/)?.[0]?.trim() ??
    '';

  const nombre =
    lineas
      .slice(0, 12)
      .find(
        (l) =>
          l.length >= 6 &&
          l.length <= 60 &&
          !NO_ES_NOMBRE.test(l) &&
          /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'’-]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ'’-]+){1,3}$/.test(l)
      ) ?? '';

  return { nombre, mail, telefono };
}

/** Lee una tanda de archivos y devuelve, por cada uno, lo que encontró. */
export async function leerCvs(archivos: File[]): Promise<(LeidoDeCv & { archivo: string })[]> {
  const leidos: (LeidoDeCv & { archivo: string })[] = [];
  for (const a of archivos.slice(0, MAXIMO_CV)) {
    if (a.size === 0 || a.size > MAX_BYTES_CV) {
      leidos.push({ archivo: a.name, nombre: '', mail: '', telefono: '' });
      continue;
    }
    try {
      const lineas = await textoDe(new Uint8Array(await a.arrayBuffer()));
      leidos.push({ archivo: a.name, ...leer(lineas) });
    } catch {
      leidos.push({ archivo: a.name, nombre: '', mail: '', telefono: '' });
    }
  }
  return leidos;
}
