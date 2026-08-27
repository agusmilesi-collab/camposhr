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

type Trozo = { str?: string; transform?: number[] };

/**
 * El texto del PDF, armado en líneas.
 *
 * pdfjs no devuelve líneas sino trozos, y los parte donde cambia la tipografía:
 * un nombre puesto arriba con una fuente por palabra llega como "Marisol",
 * "Rodríguez", "Graglia", tres trozos que ninguna regla de nombre reconoce. Se
 * juntan por su altura en la página (`transform[5]`, la Y), que es lo que los
 * hacía una sola línea a la vista.
 *
 * La tolerancia de dos puntos es por los acentos y las versalitas, que se
 * dibujan un pelo más arriba sin ser otro renglón.
 */
function enLineas(trozos: Trozo[]): string[] {
  const filas: { y: number; partes: string[] }[] = [];
  for (const t of trozos) {
    const texto = typeof t.str === 'string' ? t.str.trim() : '';
    if (!texto) continue;
    const y = Math.round(t.transform?.[5] ?? 0);
    const fila = filas.find((f) => Math.abs(f.y - y) <= 2);
    if (fila) fila.partes.push(texto);
    else filas.push({ y, partes: [texto] });
  }
  return filas.map((f) => f.partes.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * Las dos primeras páginas.
 *
 * El contacto está casi siempre arriba de la primera, pero hay CV que lo ponen
 * al final de una página de portada, y una página de más cuesta milisegundos.
 */
async function textoDe(bytes: Uint8Array): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Una copia con su propio búfer: el lector le pasa los bytes a su hilo
  // interno y no puede transferir el que llega del formulario.
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const doc = await getDocument({ data: copia, isEvalSupported: false }).promise;
  const lineas: string[] = [];
  for (let n = 1; n <= Math.min(2, doc.numPages); n++) {
    const p = await doc.getPage(n);
    const { items } = await p.getTextContent();
    lineas.push(...enLineas(items as Trozo[]));
  }
  return lineas;
}

/**
 * De dónde sale cada dato.
 *
 * El mail está escrito como tal y se encuentra con su forma. El teléfono y el
 * nombre no alcanzan con eso y cada uno tiene su trampa, escrita abajo.
 */
const NO_ES_NOMBRE =
  /curriculum|currículum|vitae|datos|personales|resumen|perfil|profesional|contacto|experiencia|educaci|formaci|antecedentes|estudios|habilidades|idiomas|referencia|objetivo|laboral|acad[eé]mic|cursos|conocimientos|tel[eé]fono|celular|correo|direcci[oó]n|nacionalidad|dni|informaci[oó]n/i;

/** Una palabra de un nombre: "Marisol", "RODRÍGUEZ", "D'Angelo". */
const PALABRA = "[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’-]+|[A-ZÁÉÍÓÚÑÜ]{2,}";

/** Las que van en minúscula en el medio de un apellido: "de la Fuente". */
const PARTICULA = 'de|del|la|las|los|van|von|di|da|do|dos|san';

const ES_NOMBRE = new RegExp(
  `^(?:${PALABRA})(?:\\s+(?:${PALABRA}|${PARTICULA})){1,3}$`
);

/**
 * El teléfono de la persona, no el primero que aparezca.
 *
 * Dos trampas, las dos vistas en CV reales: el número de una referencia laboral
 * ("Referencia: (03476) 15645765") se leía como el suyo, y un número largo se
 * cortaba a la mitad porque el patrón se conformaba con siete dígitos. Así que
 * se prefiere el que está rotulado como teléfono o celular, se descarta el que
 * viene detrás de una referencia o de un documento, y se exige un número
 * argentino entero: de ocho a trece dígitos.
 */
const CERCA_DE_TELEFONO = /(?:tel|cel|whats|m[oó]vil|contacto)[^\n]{0,20}$/i;
const NO_ES_TELEFONO = /(?:referencia|dni|d\.n\.i|cuil|cuit|legajo)[^\n]{0,20}$/i;
const NUMERO = /(?:\+?54\s?)?(?:\(?\d{2,4}\)?[\s.-]?){1,3}\d{3,4}[\s.-]?\d{0,4}/g;

function digitos(x: string): number {
  return (x.match(/\d/g) ?? []).length;
}

function telefonoDe(todo: string): string {
  let suelto = '';
  for (const m of todo.matchAll(NUMERO)) {
    const valor = m[0].trim();
    const n = digitos(valor);
    if (n < 8 || n > 13) continue;
    const antes = todo.slice(Math.max(0, m.index - 30), m.index);
    if (NO_ES_TELEFONO.test(antes)) continue;
    if (CERCA_DE_TELEFONO.test(antes)) return valor;
    if (!suelto) suelto = valor;
  }
  return suelto;
}

/**
 * El nombre no tiene forma propia: es la primera línea corta de dos a cuatro
 * palabras que encabezan en mayúscula, que es como se encabeza un CV, sin las
 * que son claramente un título de sección.
 *
 * **Y puede venir en dos renglones**: el nombre grande arriba y el apellido
 * debajo, que es una portada corriente. Por eso una línea de una sola palabra
 * se prueba junto con la que sigue. Solo de una palabra: con dos ya es un
 * nombre entero, y unirla al renglón de abajo se llevaría puesto el cargo
 * ("Juan Pérez" + "Ingeniero Industrial").
 */
function nombreDe(lineas: string[]): string {
  const sirve = (l: string) =>
    l.length >= 6 && l.length <= 60 && !NO_ES_NOMBRE.test(l) && ES_NOMBRE.test(l);

  const cabeza = lineas.slice(0, 15);
  for (let i = 0; i < cabeza.length; i++) {
    const uno = cabeza[i];
    if (!uno.includes(' ') && cabeza[i + 1]) {
      const par = `${uno} ${cabeza[i + 1]}`;
      if (sirve(par)) return par;
    }
    if (sirve(uno)) return uno;
  }
  return '';
}

export function leer(lineas: string[]): LeidoDeCv {
  const todo = lineas.join(' \n ');
  /**
   * La arroba se pega antes de buscar: el PDF parte el texto donde cambia la
   * tipografía y un mail escrito con el dominio en otro color llega como
   * "marisolrz.1111" y "@gmail.com", dos trozos que ninguna dirección
   * reconoce.
   */
  const mail = todo.replace(/\s*@\s*/g, '@').match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? '';
  const telefono = telefonoDe(todo);

  const nombre = nombreDe(lineas);

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
