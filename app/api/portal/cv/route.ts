import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo } from '@/lib/portal-demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que se puede leer de un CV, para llenar la fila del candidato.
 *
 * El cliente venía de mandar el CV por WhatsApp sin escribir nada. Pedirle que
 * transcriba el nombre, el mail y el teléfono que ya están adentro del archivo
 * es la fricción que hay que sacar: suelta los archivos y el formulario se
 * completa solo, con todo editable porque esto acierta casi siempre y no
 * siempre.
 *
 * **Se lee del lado del servidor**, con el mismo camino que ya usa el lector
 * del Benziger: en el navegador habría que servir el worker de pdfjs y bajar un
 * megabyte por visita.
 *
 * **No guarda nada.** Lee el archivo, devuelve lo que encontró y lo suelta. El
 * CV se sube cuando se manda el pedido, no acá.
 */

/** Hasta acá se leen archivos de una vez. Más que eso no es una tanda. */
const MAXIMO = 12;
const MAX_BYTES = 10 * 1024 * 1024;

type Leido = { nombre: string; mail: string; telefono: string };

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

function leer(lineas: string[]): Leido {
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

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  // El token no da acceso a nada de acá, pero sin él esto sería un lector de
  // PDF abierto a cualquiera: se exige que resuelva a un cliente.
  const token = (form.get('token') ?? '').toString().trim();
  if (!esDemo(token) && !(await empresaDelToken(token))) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  const archivos = form.getAll('cv').filter((a): a is File => a instanceof File);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }

  const leidos: (Leido & { archivo: string })[] = [];
  for (const a of archivos.slice(0, MAXIMO)) {
    // Lo que no se puede leer vuelve vacío y se escribe a mano: un CV ilegible
    // no puede dejar al cliente sin poder cargar a esa persona.
    if (a.size === 0 || a.size > MAX_BYTES) {
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

  return NextResponse.json({ leidos });
}
