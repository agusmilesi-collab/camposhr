/**
 * El recibo de un pago del alquiler, en PDF, para que lo baje el inquilino.
 *
 * Es el mismo papel que el equipo imprime desde la ficha del inquilino
 * (`os-papel-recibo` en `Ficha.tsx`): membrete del Centro, qué se recibió, de
 * quién, por qué mes y cuándo, con la firma de Lucila como titular. **Un cambio
 * en uno hay que llevarlo al otro.**
 *
 * Acá se dibuja con `pdf-lib` y no imprimiendo la página: el inquilino lo abre
 * desde el teléfono, donde "imprimir a PDF" son cuatro pasos, y tiene que
 * bajarse con un toque.
 *
 * Dice que es un comprobante interno. La factura del alquiler es otro papel.
 */

import 'server-only';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { INSTRUMENT_SERIF } from '@/lib/fuentes/instrument-serif';
import { INTER_NORMAL, INTER_SEMINEGRA } from '@/lib/fuentes/inter';
import { FIRMAS } from '@/lib/informe-textos';
import { firmaEnDatos } from '@/lib/firmas';
import { mesLargo } from '@/lib/consultorios-calculo';
import { hoyIso } from '@/lib/hora';

/** Siempre ella: es quien firma los recibos del Centro, registre quien registre. */
const QUIEN_FIRMA = 'Lucila Campos';

const limpio = (t: string) => t.replace(/[^\x20-\x7E -ÿ]/g, '');

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );

/**
 * Lo que dice un recibo: de quién, por qué mes y con qué pagos.
 *
 * **Un recibo puede juntar varios pagos.** Quien paga el mes en cuatro
 * transferencias no quiere cuatro papeles: quiere uno que diga que septiembre
 * está pagado, con las cuatro fechas adentro. Con un solo pago es el recibo de
 * siempre.
 */
export type ReciboDelCentro = {
  inquilino: string;
  periodo: string | null;
  pagos: { id: string; fecha: string; importe: number; detalle: string | null }[];
};

export function archivoDelRecibo(r: ReciboDelCentro): string {
  const de = r.pagos.length === 1 ? r.pagos[0].fecha : (r.periodo ?? '').slice(0, 7);
  return `${limpio(`Recibo de pago ${r.inquilino} ${de}`).replace(/[^\w\- ]+/g, '').trim()}.pdf`;
}

export async function pdfDelRecibo(r: ReciboDelCentro): Promise<Uint8Array> {
  const pagos = [...r.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const uno = pagos.length === 1 ? pagos[0] : null;
  const total = pagos.reduce((n, x) => n + x.importe, 0);
  // El número sale del pago cuando es uno, y del mes cuando los junta.
  const numero = uno
    ? uno.id.slice(0, 8).toUpperCase()
    : `${(r.periodo ?? '').slice(0, 7)}-${pagos[0].id.slice(0, 4).toUpperCase()}`;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [serif, normal, negra] = await Promise.all([
    pdf.embedFont(Buffer.from(INSTRUMENT_SERIF, 'base64'), { subset: true }),
    // Inter ya viene recortada al castellano; recortarla de nuevo le saca letras.
    pdf.embedFont(Buffer.from(INTER_NORMAL, 'base64'), { subset: false }),
    pdf.embedFont(Buffer.from(INTER_SEMINEGRA, 'base64'), { subset: false }),
  ]);
  const tinta = rgb(0x16 / 255, 0x20 / 255, 0x2b / 255);
  const gris = rgb(0x7b / 255, 0x77 / 255, 0x70 / 255);
  const linea = rgb(0xe2 / 255, 0xde / 255, 0xd6 / 255);

  const ANCHO = 595.28;
  const ALTO = 841.89;
  const IZQ = 64;
  const DER = ANCHO - 64;
  const hoja = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - 72;

  hoja.drawText('Centro Integral Santiago', { x: IZQ, y, size: 20, font: serif, color: tinta });
  const sitio = 'Santiago 1269, Rosario';
  hoja.drawText(sitio, {
    x: DER - normal.widthOfTextAtSize(sitio, 9.5),
    y: y + 3,
    size: 9.5,
    font: normal,
    color: gris,
  });
  y -= 16;
  hoja.drawLine({ start: { x: IZQ, y }, end: { x: DER, y }, thickness: 0.75, color: linea });

  y -= 54;
  hoja.drawText('Recibo de pago', { x: IZQ, y, size: 26, font: serif, color: tinta });
  y -= 18;
  hoja.drawText(`N.º ${numero}`, { x: IZQ, y, size: 9.5, font: normal, color: gris });

  y -= 44;
  const datos: [string, string, boolean?][] = [
    ['Recibí de', r.inquilino],
    ['La suma de', pesos(total), true],
    ['En concepto de', `Alquiler de consultorio${r.periodo ? ` · ${mesLargo(r.periodo)}` : ''}`],
    ...(uno
      ? ([
          ['Forma de pago', uno.detalle ?? 'Sin especificar'],
          ['Fecha', fechaLarga(uno.fecha)],
        ] as [string, string][])
      : ([['Recibido en', `${pagos.length} pagos`]] as [string, string][])),
  ];
  for (const [rotulo, valor, fuerte] of datos) {
    hoja.drawText(limpio(rotulo), { x: IZQ, y, size: 10, font: normal, color: gris });
    hoja.drawText(limpio(valor), {
      x: IZQ + 130,
      y,
      size: fuerte ? 13 : 11,
      font: fuerte ? negra : normal,
      color: tinta,
    });
    y -= 12;
    hoja.drawLine({ start: { x: IZQ, y }, end: { x: DER, y }, thickness: 0.5, color: linea });
    y -= 22;
  }

  // Con varios pagos, uno por renglón: cuándo entró cada uno, cómo y cuánto.
  if (!uno) {
    y -= 6;
    for (const x of pagos) {
      hoja.drawText(limpio(fechaLarga(x.fecha)), { x: IZQ + 130, y, size: 10, font: normal, color: tinta });
      hoja.drawText(limpio(x.detalle ?? ''), { x: IZQ + 290, y, size: 10, font: normal, color: gris });
      const importe = pesos(x.importe);
      hoja.drawText(importe, {
        x: DER - normal.widthOfTextAtSize(importe, 10),
        y,
        size: 10,
        font: normal,
        color: tinta,
      });
      y -= 18;
    }
    y -= 4;
  }

  // La firma, a la izquierda, que es donde firma quien emite.
  y -= 40;
  const suya = FIRMAS[QUIEN_FIRMA];
  const trazo = suya?.trazo ? await firmaEnDatos(suya.trazo) : null;
  if (trazo) {
    const imagen = await pdf.embedPng(Buffer.from(trazo.split(',')[1], 'base64'));
    const alto = 56;
    const ancho = (imagen.width / imagen.height) * alto;
    hoja.drawImage(imagen, { x: IZQ, y: y - 8, width: ancho, height: alto });
  } else {
    // Sin trazo cargado se firma a mano, sobre la raya.
    hoja.drawLine({ start: { x: IZQ, y }, end: { x: IZQ + 170, y }, thickness: 0.75, color: tinta });
  }
  y -= 22;
  hoja.drawText(QUIEN_FIRMA, { x: IZQ, y, size: 10.5, font: negra, color: tinta });
  y -= 14;
  hoja.drawText('Titular · Centro Integral Santiago', { x: IZQ, y, size: 9.5, font: normal, color: gris });

  hoja.drawText(
    limpio(`Comprobante interno de pago, sin validez fiscal. Emitido el ${fechaLarga(hoyIso())}.`),
    { x: IZQ, y: 64, size: 8.5, font: normal, color: gris }
  );

  return pdf.save();
}
