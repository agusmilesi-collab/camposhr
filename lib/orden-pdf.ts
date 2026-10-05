/**
 * La orden de compra, dibujada en PDF.
 *
 * **El diseño se decide en la página** (`/os/psicotecnicos/facturacion/orden/<id>`)
 * y acá se copia: son las mismas medidas, pasadas de píxeles a puntos (por
 * 0,75). Si se cambia una, se cambia la otra.
 *
 * Se dibuja con `pdf-lib` y no imprimiendo una página: tiene que bajarse sola
 * con un botón y poder adjuntarse a un correo, sin navegador de por medio.
 *
 * De arriba abajo: la marca sobre una banda del color del papel del sitio; el
 * número y los datos; el detalle, con una línea de puntos del concepto a su
 * importe; el total en una barra del color de los botones del OS; y las
 * condiciones. Una orden larga sigue en otra hoja.
 *
 * Las tipografías son las del sitio, incrustadas: Instrument Serif para la
 * marca, que es su logotipo, e Inter para todo lo demás.
 */

import 'server-only';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { INSTRUMENT_SERIF } from '@/lib/fuentes/instrument-serif';
import { INTER_NORMAL, INTER_SEMINEGRA } from '@/lib/fuentes/inter';
import {
  BAJADA,
  SITIO,
  formaDeOrden,
  notasDe,
  pesosDeOrden as pesos,
  type FormaDelPapel,
  type Orden,
} from '@/lib/orden-compra-tipos';

/** Parte un texto en renglones que entran en ese ancho. */
function partir(texto: string, fuente: PDFFont, cuerpo: number, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, cuerpo) <= ancho || !actual) actual = prueba;
    else {
      renglones.push(actual);
      actual = palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Lo que las tipografías incrustadas no traen (emojis, signos raros) se saca. */
const limpio = (t: string) => t.replace(/[^\x20-\x7E -ÿ]/g, '');

/** El nombre del archivo que se baja o se adjunta. */
export function archivoDeOrden(orden: Orden, comienzo = 'Orden de compra'): string {
  const nombre = limpio(
    `${comienzo} ${orden.numero ? orden.numero + ' ' : ''}${orden.cliente} ${orden.fecha.slice(0, 10)}`
  )
    .replace(/[^\w\- ]+/g, '')
    .trim();
  return `${nombre}.pdf`;
}

export async function pdfDeOrden(
  orden: Orden,
  forma: FormaDelPapel = formaDeOrden(orden)
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const ALTO = 841.89;
  const ANCHO_HOJA = 595.28;
  const [serif, normal, negra] = await Promise.all([
    pdf.embedFont(Buffer.from(INSTRUMENT_SERIF, 'base64'), { subset: true }),
    // Inter ya viene recortada al castellano; recortarla de nuevo acá le
    // sacaba letras.
    pdf.embedFont(Buffer.from(INTER_NORMAL, 'base64'), { subset: false }),
    pdf.embedFont(Buffer.from(INTER_SEMINEGRA, 'base64'), { subset: false }),
  ]);
  // Los colores del OS: la tinta de los botones, el papel del fondo y sus grises.
  const tinta = rgb(0x16 / 255, 0x20 / 255, 0x2b / 255);
  const clara = rgb(0xf6 / 255, 0xf5 / 255, 0xf2 / 255);
  const papel = rgb(0xf2 / 255, 0xf0 / 255, 0xec / 255);
  const media = rgb(0x46 / 255, 0x50 / 255, 0x5c / 255);
  const gris = rgb(0x7b / 255, 0x77 / 255, 0x70 / 255);
  const linea = rgb(0xe2 / 255, 0xde / 255, 0xd6 / 255);
  const punto = rgb(0xb9 / 255, 0xb4 / 255, 0xaa / 255);

  const IZQ = 56;
  const DER = ANCHO_HOJA - 56;
  const ANCHO = DER - IZQ;
  /** Hasta dónde se puede escribir: debajo está el pie. */
  const PISO = 72;

  let hoja: PDFPage = pdf.addPage([ANCHO_HOJA, ALTO]);
  let y = ALTO;

  const ancho = (t: string, cuerpo: number, fuente: PDFFont = normal) =>
    fuente.widthOfTextAtSize(limpio(t), cuerpo);
  const texto = (
    t: string,
    x: number,
    cuerpo: number,
    o: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean; en?: number } = {}
  ) => {
    const fuente = o.fuente ?? normal;
    const s = limpio(t);
    hoja.drawText(s, {
      x: o.derecha ? x - fuente.widthOfTextAtSize(s, cuerpo) : x,
      y: o.en ?? y,
      size: cuerpo,
      font: fuente,
      color: o.color ?? tinta,
    });
  };
  const raya = (en = y) => {
    hoja.drawLine({ start: { x: IZQ, y: en }, end: { x: DER, y: en }, thickness: 0.75, color: linea });
  };
  /**
   * Un texto con las letras separadas. `pdf-lib` no sabe espaciar, así que se
   * dibuja letra por letra. Con `hasta`, alineado a la derecha.
   */
  const abierto = (
    t: string,
    cuerpo: number,
    aire: number,
    en: number,
    o: { desde?: number; hasta?: number } = {}
  ) => {
    const letras = [...limpio(t)];
    const largo =
      letras.reduce((n, l) => n + normal.widthOfTextAtSize(l, cuerpo), 0) + aire * (letras.length - 1);
    let x = o.hasta !== undefined ? o.hasta - largo : o.desde ?? IZQ;
    for (const l of letras) {
      hoja.drawText(l, { x, y: en, size: cuerpo, font: normal, color: gris });
      x += normal.widthOfTextAtSize(l, cuerpo) + aire;
    }
  };
  /** La línea de puntos que lleva la vista del concepto a su importe. */
  const puntos = (desde: number, hasta: number, en: number) => {
    if (hasta - desde < 12) return;
    hoja.drawLine({
      start: { x: desde, y: en + 2 },
      end: { x: hasta, y: en + 2 },
      thickness: 0.9,
      color: punto,
      dashArray: [0.1, 3.2],
      lineCap: 1,
    });
  };
  /** El pie de cada hoja: la bajada a la izquierda y el sitio a la derecha. */
  const pie = () => {
    raya(52);
    abierto(BAJADA.join('   ·   ').toUpperCase(), 6.75, 0.27, 35);
    abierto(SITIO.toUpperCase(), 7.6, 1.8, 35, { hasta: DER });
  };
  /**
   * Si lo que sigue no entra, pasa a otra hoja. La orden de seis personas con
   * adicional ya no entra en una, y cortar un renglón por la mitad o pisar el
   * pie es peor que seguir en la siguiente.
   */
  const hacerLugar = (alto: number) => {
    if (y - alto >= PISO) return;
    hoja = pdf.addPage([ANCHO_HOJA, ALTO]);
    pie();
    y = ALTO - 64;
  };

  // ------------------------------------------------------------- la marca
  // Sobre una banda del color del papel, de borde a borde. El sitio apoya en
  // la misma línea que las letras del logotipo.
  const BANDA = 88.5;
  hoja.drawRectangle({ x: 0, y: ALTO - BANDA, width: ANCHO_HOJA, height: BANDA, color: papel });
  texto('Campos HR', IZQ, 36, { fuente: serif, en: ALTO - 58.5 });
  abierto(SITIO.toUpperCase(), 7.9, 1.9, ALTO - 58.5, { hasta: DER });
  pie();

  // ------------------------------------------------ el número y los datos
  y = ALTO - BANDA - 30 - 12;
  texto(forma.titulo, IZQ, 13.9, { fuente: negra });
  if (orden.numero) {
    texto(`${forma.prefijo ?? '#'}${orden.numero}`, IZQ + ancho(forma.titulo, 13.9, negra) + 6, 13.9, {
      fuente: negra,
      color: gris,
    });
  }
  y -= 6;
  const dato = (rotulo: string, valor: string) => {
    const corrido = IZQ + ancho(rotulo, 9) + 3.5;
    for (const [i, t] of partir(valor, normal, 9, DER - corrido).entries()) {
      y -= 15.3;
      if (i === 0) texto(rotulo, IZQ, 9, { color: gris });
      texto(t, corrido, 9, { color: media });
    }
  };
  for (const d of forma.datos) dato(`${d.rotulo}:`, d.valor);

  y -= 24;
  raya();

  // -------------------------------------------------------------- el detalle
  y -= 16.5 + 11;
  texto('Detalle', IZQ, 11.25, { fuente: negra });
  y -= 3;

  const filas = orden.filas;

  const TOPE_TEXTO = DER - 110;
  for (const r of filas) {
    const partes = partir(r.concepto, normal, 9.4, TOPE_TEXTO - IZQ);
    const subs = r.detalle ? partir(r.detalle, normal, 7.9, TOPE_TEXTO - IZQ) : [];
    hacerLugar(4.5 + partes.length * 12.7 + subs.length * 9.8);
    y -= 4.5 + 12.7;
    partes.forEach((t, i) => texto(t, IZQ, 9.4, { color: media, en: y - i * 12.7 }));
    y -= (partes.length - 1) * 12.7;
    const importe = r.importe === null ? '' : pesos(r.importe);
    if (importe) {
      texto(importe, DER, 9.4, { fuente: negra, derecha: true });
      puntos(
        IZQ + ancho(partes[partes.length - 1], 9.4) + 7.5,
        DER - ancho(importe, 9.4, negra) - 7.5,
        y
      );
    }
    for (const t of subs) {
      y -= 9.8;
      texto(t, IZQ, 7.9, { color: gris });
    }
  }
  // Lo que aclara a varios renglones a la vez, dicho una sola vez.
  for (const n of notasDe(filas)) {
    const partes = partir(n, normal, 7.9, ANCHO);
    hacerLugar(7.5 + partes.length * 10.5);
    y -= 7.5;
    for (const t of partes) {
      y -= 10.5;
      texto(t, IZQ, 7.9, { color: gris });
    }
  }

  // ------------------------------------------------------------------ el total
  const total = orden.total;
  const BARRA = 40.5;
  hacerLugar(13.5 + 19.5 + 11 + 16.5 + BARRA);
  y -= 13.5;
  raya();
  y -= 19.5 + 10;
  texto('Subtotal', IZQ, 10.5, { color: gris });
  texto(pesos(total), DER, 9.4, { fuente: negra, derecha: true });
  puntos(IZQ + ancho('Subtotal', 10.5) + 7.5, DER - ancho(pesos(total), 9.4, negra) - 7.5, y);

  // El total, en una barra del color de los botones: es el número que el
  // cliente tiene que encontrar sin leer el resto.
  y -= 16.5 + 3;
  const R = 8.25;
  hoja.drawSvgPath(
    `M ${R} 0 H ${ANCHO - R} Q ${ANCHO} 0 ${ANCHO} ${R} V ${BARRA - R} Q ${ANCHO} ${BARRA} ${ANCHO - R} ${BARRA} ` +
      `H ${R} Q 0 ${BARRA} 0 ${BARRA - R} V ${R} Q 0 0 ${R} 0 Z`,
    { x: IZQ, y, color: tinta }
  );
  texto(forma.rotuloTotal, IZQ + 18, 12, { fuente: negra, color: clara, en: y - BARRA / 2 - 4.2 });
  texto(pesos(total), DER - 18, 13.1, { fuente: negra, color: clara, en: y - BARRA / 2 - 4.6, derecha: true });
  y -= BARRA;

  // ------------------------------------------------------------ las condiciones
  const condiciones = forma.cierre.lineas;
  hacerLugar(22.5 + 10 + condiciones.length * 14.85);
  y -= 22.5 + 9.5;
  texto(forma.cierre.titulo, IZQ, 9.75, { fuente: negra });
  y -= 3;
  for (const c of condiciones) {
    const rotulo = `${c.rotulo}:`;
    const corrido = IZQ + ancho(rotulo, 9) + 3.5;
    for (const [i, t] of partir(c.texto, normal, 9, DER - corrido).entries()) {
      hacerLugar(14.85);
      y -= 14.85;
      if (i === 0) texto(rotulo, IZQ, 9, { color: gris });
      texto(t, corrido, 9, { color: media });
    }
  }

  return pdf.save();
}
