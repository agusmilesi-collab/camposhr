/**
 * La factura (y la nota de crédito) dibujada en PDF, con sus tres ejemplares.
 *
 * Es el archivo que se guarda cuando ARCA autoriza y el que se le manda al
 * cliente: un comprobante emitido tiene que existir como archivo, igual desde
 * el día uno, y no depender de que alguien lo imprima desde la pantalla.
 *
 * **El diseño se decide en la página** (`comprobante/[id]/Comprobante.tsx` y
 * `factura.css`) y acá se copia: las mismas medidas, pasadas de píxeles a
 * puntos (por 0,75). Si se cambia una, se cambia la otra. Los datos salen de
 * la misma pieza (`lib/factura-datos.ts`), así que el contenido no se puede
 * separar; lo que sí puede separarse es el dibujo.
 *
 * Tres hojas, una por ejemplar (original, duplicado y triplicado), que solo
 * cambian en el sello de arriba.
 */

import 'server-only';
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { INSTRUMENT_SERIF } from '@/lib/fuentes/instrument-serif';
import { INTER_NORMAL, INTER_SEMINEGRA } from '@/lib/fuentes/inter';
import { LOGO_ARCA } from '@/lib/marcas/arca';
import { SITIO } from '@/lib/orden-compra-tipos';
import { EJEMPLARES, type DatosFactura } from '@/lib/factura-datos';

const pesos = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lo que las tipografías incrustadas no traen (emojis, signos raros) se saca. */
// La raya larga que marca un dato vacío no está en la tipografía recortada:
// va un guion, que sí.
const limpio = (t: string) => t.replace(/\u2014/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '');

function partir(texto: string, fuente: PDFFont, cuerpo: number, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of limpio(texto).split(/\s+/)) {
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

/**
 * El logotipo de ARCA como trazos: el SVG oficial, pasado a los caminos que
 * `pdf-lib` sabe dibujar. Los rectángulos y los polígonos se escriben como
 * caminos; los `path` van tal cual.
 */
const TRAZOS_ARCA: string[] = (() => {
  const trazos: string[] = [];
  for (const m of LOGO_ARCA.matchAll(/<path[^>]*\sd="([^"]+)"/g)) trazos.push(m[1]);
  for (const m of LOGO_ARCA.matchAll(/<rect([^>]*)\/>/g)) {
    const n = (k: string) => Number(m[1].match(new RegExp(`\\s${k}="([^"]+)"`))?.[1] ?? 0);
    const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
    trazos.push(`M ${x} ${y} h ${w} v ${h} h ${-w} Z`);
  }
  for (const m of LOGO_ARCA.matchAll(/<polygon[^>]*\spoints="([^"]+)"/g)) {
    const puntos = m[1].trim().split(/\s+/);
    trazos.push(`M ${puntos.map((p) => p.replace(',', ' ')).join(' L ')} Z`);
  }
  return trazos;
})();
/** El ancho del dibujo original, para escalarlo. */
const ANCHO_ARCA = 590.459;

/** El nombre del archivo que se baja, se guarda o se adjunta. */
export function archivoDeFactura(d: DatosFactura): string {
  const nombre = limpio(`${d.titulo} C ${d.numeroLargo} ${d.cliente.nombre}`)
    .replace(/[^\w\- ]+/g, '')
    .trim();
  return `${nombre}.pdf`;
}

export async function pdfDeFactura(d: DatosFactura): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const ALTO = 841.89;
  const ANCHO_HOJA = 595.28;
  const [serif, normal, negra] = await Promise.all([
    pdf.embedFont(Buffer.from(INSTRUMENT_SERIF, 'base64'), { subset: true }),
    // Inter ya viene recortada al castellano; recortarla de nuevo le sacaba letras.
    pdf.embedFont(Buffer.from(INTER_NORMAL, 'base64'), { subset: false }),
    pdf.embedFont(Buffer.from(INTER_SEMINEGRA, 'base64'), { subset: false }),
  ]);
  const tinta = rgb(0x16 / 255, 0x20 / 255, 0x2b / 255);
  const clara = rgb(0xf6 / 255, 0xf5 / 255, 0xf2 / 255);
  const papel = rgb(0xf2 / 255, 0xf0 / 255, 0xec / 255);
  const media = rgb(0x46 / 255, 0x50 / 255, 0x5c / 255);
  const gris = rgb(0x7b / 255, 0x77 / 255, 0x70 / 255);
  const linea = rgb(0xe2 / 255, 0xde / 255, 0xd6 / 255);
  const punto = rgb(0xb9 / 255, 0xb4 / 255, 0xaa / 255);
  const arca = rgb(0x24 / 255, 0x2c / 255, 0x4f / 255);

  const IZQ = 56;
  const DER = ANCHO_HOJA - 56;
  const ANCHO = DER - IZQ;

  // El QR se arma una vez: es el mismo en los tres ejemplares.
  const qr = d.qr ? QRCode.create(d.qr, { errorCorrectionLevel: 'M' }) : null;

  for (const ejemplar of EJEMPLARES) {
    let hoja: PDFPage = pdf.addPage([ANCHO_HOJA, ALTO]);

    const ancho = (t: string, cuerpo: number, fuente: PDFFont = normal) =>
      fuente.widthOfTextAtSize(limpio(t), cuerpo);
    const texto = (
      t: string,
      x: number,
      y: number,
      cuerpo: number,
      o: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}
    ) => {
      const fuente = o.fuente ?? normal;
      const s = limpio(t);
      hoja.drawText(s, {
        x: o.derecha ? x - fuente.widthOfTextAtSize(s, cuerpo) : x,
        y,
        size: cuerpo,
        font: fuente,
        color: o.color ?? tinta,
      });
    };
    const raya = (y: number) =>
      hoja.drawLine({ start: { x: IZQ, y }, end: { x: DER, y }, thickness: 0.75, color: linea });
    /** Letras separadas, dibujadas de a una: `pdf-lib` no sabe espaciar. */
    const abierto = (
      t: string,
      cuerpo: number,
      aire: number,
      y: number,
      o: { desde?: number; hasta?: number; centro?: number; color?: ReturnType<typeof rgb> } = {}
    ) => {
      const letras = [...limpio(t)];
      const largo =
        letras.reduce((n, l) => n + normal.widthOfTextAtSize(l, cuerpo), 0) + aire * (letras.length - 1);
      let x =
        o.hasta !== undefined
          ? o.hasta - largo
          : o.centro !== undefined
            ? o.centro - largo / 2
            : o.desde ?? IZQ;
      const desde = x;
      for (const l of letras) {
        hoja.drawText(l, { x, y, size: cuerpo, font: normal, color: o.color ?? gris });
        x += normal.widthOfTextAtSize(l, cuerpo) + aire;
      }
      return { desde, largo };
    };
    /** Un rótulo en gris y su valor al lado. Devuelve dónde termina. */
    const par = (
      rotulo: string,
      valor: string,
      x: number,
      y: number,
      cuerpo: number,
      o: { fuerte?: boolean } = {}
    ) => {
      texto(rotulo, x, y, cuerpo, { color: gris });
      const xv = x + ancho(rotulo, cuerpo) + 3;
      const fuente = o.fuerte ? negra : normal;
      texto(valor, xv, y, cuerpo, { fuente, color: o.fuerte ? tinta : media });
      return xv + ancho(valor, cuerpo, fuente);
    };
    const redondo = (x: number, yArriba: number, w: number, h: number, r: number) =>
      `M ${x + r} ${0} H ${x + w - r} Q ${x + w} 0 ${x + w} ${r} V ${h - r} Q ${x + w} ${h} ${x + w - r} ${h} ` +
      `H ${x + r} Q ${x} ${h} ${x} ${h - r} V ${r} Q ${x} 0 ${x + r} 0 Z`;

    // ---------------------------------------------------------------- la marca
    const BANDA = 91.5;
    hoja.drawRectangle({ x: 0, y: ALTO - BANDA, width: ANCHO_HOJA, height: BANDA, color: papel });
    const base = ALTO - 61.5;
    texto(d.emisor.marca, IZQ, base, 36, { fuente: serif });
    abierto(SITIO.toUpperCase(), 7.9, 1.9, base, { hasta: DER });
    // Qué ejemplar es, en su sello, arriba y al medio.
    {
      const y = ALTO - 20;
      const { desde, largo } = abierto(ejemplar.toUpperCase(), 6.4, 1.3, y, { centro: ANCHO_HOJA / 2 });
      hoja.drawSvgPath(redondo(0, 0, largo + 17, 12.5, 6.2), {
        x: desde - 9,
        y: y + 8.6,
        borderColor: punto,
        borderWidth: 0.75,
      });
    }

    // ------------------------------------------------- qué comprobante es
    let y = ALTO - BANDA - 25.5;
    const LETRA = 39;
    hoja.drawSvgPath(redondo(0, 0, LETRA, LETRA, 8.25), { x: IZQ, y, color: tinta });
    texto('C', IZQ + (LETRA - serif.widthOfTextAtSize('C', 27)) / 2, y - LETRA / 2 - 9, 27, {
      fuente: serif,
      color: clara,
    });
    abierto(`CÓD. ${d.codigo}`, 5.6, 0.7, y - LETRA - 9, { centro: IZQ + LETRA / 2 });

    const X_TIT = IZQ + LETRA + 13.5;
    texto(d.titulo, X_TIT, y - 13, 13.9, { fuente: negra });
    let yt = y - 31;
    const fin = par('Punto de venta:', d.puntoVenta, X_TIT, yt, 9, { fuerte: true });
    par('Comp. Nro:', d.numero, fin + 12, yt, 9, { fuerte: true });
    yt -= 15.3;
    par('Fecha de emisión:', d.fecha, X_TIT, yt, 9, { fuerte: true });
    if (d.anula) {
      yt -= 15.3;
      const f2 = par('Anula la Factura C N°:', d.anula.numero, X_TIT, yt, 9, { fuerte: true });
      par('del', d.anula.fecha, f2 + 8, yt, 9);
    }
    // El período, a la derecha.
    {
      const linea1 = `${d.desde} al ${d.hasta}`;
      texto(linea1, DER, y - 14, 9, { color: media, derecha: true });
      texto('Período facturado:', DER - ancho(linea1, 9) - 3, y - 14, 9, { color: gris, derecha: true });
      texto(d.vencePago, DER, y - 29.3, 9, { color: media, derecha: true });
      texto('Vto. para el pago:', DER - ancho(d.vencePago, 9) - 3, y - 29.3, 9, {
        color: gris,
        derecha: true,
      });
    }
    y = Math.min(yt, y - LETRA - 12) - 18;
    raya(y);

    // ------------------------------------------- quién emite y a quién
    const COL = (ANCHO - 24) / 2;
    const bloque = (titulo: string, nombre: string, lineas: [string, string, boolean?][], x: number) => {
      let yy = y - 22;
      abierto(titulo.toUpperCase(), 6.75, 1.1, yy, { desde: x });
      yy -= 16;
      for (const r of partir(nombre, negra, 9.75, COL)) {
        texto(r, x, yy, 9.75, { fuente: negra });
        yy -= 14.6;
      }
      for (const [rotulo, valor, fuerte] of lineas) {
        const xv = x + ancho(rotulo, 8.6) + 3;
        const partes = partir(valor, fuerte ? negra : normal, 8.6, x + COL - xv);
        texto(rotulo, x, yy, 8.6, { color: gris });
        partes.forEach((t, i) => {
          if (i === 0) texto(t, xv, yy, 8.6, { fuente: fuerte ? negra : normal, color: fuerte ? tinta : media });
          else texto(t, x, yy, 8.6, { fuente: fuerte ? negra : normal, color: fuerte ? tinta : media });
          if (i < partes.length - 1) yy -= 14.6;
        });
        yy -= 14.6;
      }
      return yy;
    };
    const finEmisor = bloque(
      'Emite',
      d.emisor.razonSocial,
      [
        ['CUIT:', d.emisor.cuit],
        ['Condición frente al IVA:', d.emisor.condicionIva],
        ['Domicilio comercial:', d.emisor.domicilio],
        ['Ingresos Brutos:', d.emisor.ingresosBrutos],
        ['Inicio de actividades:', d.emisor.inicio],
      ],
      IZQ
    );
    const finCliente = bloque(
      'Cliente',
      d.cliente.razonSocial,
      [
        [`${d.cliente.documento.rotulo}:`, d.cliente.documento.valor],
        ['Condición frente al IVA:', d.cliente.condicionIva],
        ['Domicilio:', d.cliente.domicilio],
        ['Condición de venta:', 'Transferencia bancaria'],
        ...(d.cliente.ordenPropia
          ? ([['Orden de compra del cliente:', d.cliente.ordenPropia, true]] as [string, string, boolean][])
          : []),
        ...(d.cliente.ordenesNuestras.length > 0
          ? ([
              [
                d.cliente.ordenesNuestras.length === 1
                  ? 'Orden de compra Campos HR:'
                  : 'Órdenes de compra Campos HR:',
                d.cliente.ordenesNuestras.map((n) => `#${n}`).join(', '),
              ],
            ] as [string, string][])
          : []),
      ],
      IZQ + COL + 24
    );
    y = Math.min(finEmisor, finCliente) - 4;
    raya(y);

    // ------------------------------------------------------------- la tabla
    const T = {
      texto: IZQ + 7.5,
      // Medidas contra un subtotal de siete cifras: más a la derecha, el
      // porcentaje de bonificación quedaba pisado por él.
      cantidad: IZQ + 262,
      unidad: IZQ + 276,
      precio: IZQ + 374,
      bonif: IZQ + 414,
      subtotal: DER - 7.5,
    };
    const cabeza = () => {
      y -= 16.5;
      hoja.drawSvgPath(redondo(0, 0, ANCHO, 22, 6), { x: IZQ, y, color: papel });
      const yc = y - 14.5;
      texto('Producto / Servicio', T.texto, yc, 7.5, { fuente: negra });
      texto('Cantidad', T.cantidad, yc, 7.5, { fuente: negra, derecha: true });
      texto('U. medida', T.unidad, yc, 7.5, { fuente: negra });
      texto('Precio unit.', T.precio, yc, 7.5, { fuente: negra, derecha: true });
      texto('% Bonif.', T.bonif, yc, 7.5, { fuente: negra, derecha: true });
      texto('Subtotal', T.subtotal, yc, 7.5, { fuente: negra, derecha: true });
      y -= 22;
    };
    cabeza();
    // Hasta dónde puede bajar la tabla: debajo van los totales, el CAE y el pie.
    const PISO = 232;
    for (const r of d.renglones) {
      const partes = partir(r.texto, normal, 8.6, T.cantidad - 46 - T.texto);
      const alto = 13.5 + partes.length * 12.4;
      if (y - alto < PISO) {
        // Una factura de muchas personas sigue en otra hoja del mismo ejemplar.
        texto('Sigue en la hoja siguiente', DER, PISO - 12, 7.5, { color: gris, derecha: true });
        hoja = pdf.addPage([ANCHO_HOJA, ALTO]);
        y = ALTO - 56;
        texto(`${d.titulo} C N° ${d.numeroLargo} · ${ejemplar} · continuación`, IZQ, y, 8, { color: gris });
        y -= 6;
        cabeza();
      }
      y -= 16.5;
      partes.forEach((t, i) => texto(t, T.texto, y - i * 12.4, 8.6));
      const importe = r.importe === null ? '—' : pesos(r.importe);
      texto('1,00', T.cantidad, y, 8.6, { color: media, derecha: true });
      texto('unidades', T.unidad, y, 8.6, { color: media });
      texto(importe, T.precio, y, 8.6, { color: media, derecha: true });
      texto('0,00', T.bonif, y, 8.6, { color: media, derecha: true });
      texto(importe, T.subtotal, y, 8.6, { fuente: negra, derecha: true });
      y -= (partes.length - 1) * 12.4 + 9.5;
      raya(y);
    }

    // -------------------------------- los totales, el CAE y el pie, anclados abajo
    const puntos = (desde: number, hasta: number, en: number) =>
      hoja.drawLine({
        start: { x: desde, y: en + 2 },
        end: { x: hasta, y: en + 2 },
        thickness: 0.9,
        color: punto,
        dashArray: [0.1, 3.2],
        lineCap: 1,
      });
    const lineaTotal = (rotulo: string, valor: string, en: number) => {
      texto(rotulo, IZQ, en, 9.75, { color: gris });
      texto(valor, DER, en, 9.4, { fuente: negra, derecha: true });
      puntos(IZQ + ancho(rotulo, 9.75) + 7.5, DER - ancho(valor, 9.4, negra) - 7.5, en);
    };
    lineaTotal('Subtotal', `$ ${pesos(d.total)}`, 213.5);
    lineaTotal('Importe otros tributos', `$ ${pesos(0)}`, 195.5);
    const BARRA = 40.5;
    hoja.drawSvgPath(redondo(0, 0, ANCHO, BARRA, 8.25), { x: IZQ, y: 142 + BARRA, color: tinta });
    texto('Importe total', IZQ + 18, 142 + BARRA / 2 - 4.2, 12, { fuente: negra, color: clara });
    texto(`$ ${pesos(d.total)}`, DER - 18, 142 + BARRA / 2 - 4.6, 13.1, {
      fuente: negra,
      color: clara,
      derecha: true,
    });

    // El QR, o su lugar vacío.
    const QR = 63;
    const yQr = 65.5;
    if (qr) {
      const n = qr.modules.size;
      const celda = QR / n;
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) {
          if (!qr.modules.get(f, c)) continue;
          hoja.drawRectangle({
            x: IZQ + c * celda,
            y: yQr + QR - (f + 1) * celda,
            // Un pelo más grande que la celda: sin eso, entre módulos queda
            // una línea blanca finita que algunos lectores no perdonan.
            width: celda + 0.15,
            height: celda + 0.15,
            color: rgb(0, 0, 0),
          });
        }
      }
    } else {
      hoja.drawSvgPath(redondo(0, 0, QR, QR, 6), {
        x: IZQ,
        y: yQr + QR,
        borderColor: punto,
        borderWidth: 0.75,
        borderDashArray: [3, 2.4],
      });
      abierto('QR', 7.5, 1, yQr + QR / 2 - 3, { centro: IZQ + QR / 2 });
    }
    // El logotipo de ARCA, al lado del QR, como en su comprobante.
    const X_ARCA = IZQ + QR + 13.5;
    const ANCHO_LOGO = 142.5;
    const escala = ANCHO_LOGO / ANCHO_ARCA;
    for (const trazo of TRAZOS_ARCA) {
      hoja.drawSvgPath(trazo, { x: X_ARCA, y: yQr + QR - 1, scale: escala, color: arca });
    }
    texto(
      d.conCae ? (d.dePrueba ? 'Autorizado en homologación' : 'Comprobante autorizado') : 'Comprobante sin autorizar',
      X_ARCA,
      yQr + QR - 31,
      9.4,
      { fuente: negra }
    );
    partir(
      'Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación.',
      normal,
      7.1,
      250
    ).forEach((t, i) => texto(t, X_ARCA, yQr + QR - 43 - i * 10, 7.1, { color: gris }));
    // El CAE, a la derecha.
    {
      const cae = d.cae ?? '—';
      texto(cae, DER, yQr + QR / 2 + 3, 8.6, { fuente: negra, derecha: true });
      texto('CAE N°:', DER - ancho(cae, 8.6, negra) - 3, yQr + QR / 2 + 3, 8.6, { color: gris, derecha: true });
      const vence = d.caeVence ?? '—';
      texto(vence, DER, yQr + QR / 2 - 12.5, 8.6, { fuente: negra, derecha: true });
      texto('Fecha de vto. de CAE:', DER - ancho(vence, 8.6, negra) - 3, yQr + QR / 2 - 12.5, 8.6, {
        color: gris,
        derecha: true,
      });
    }
    raya(52);
    abierto(SITIO.toUpperCase(), 7.6, 1.8, 35, { hasta: DER });

    // La de homologación tiene CAE y se ve como una factura: la marca es lo
    // único que impide mandarla por error.
    if (d.conCae && d.dePrueba) {
      hoja.drawText('PRUEBA', {
        x: 120,
        y: 300,
        size: 100,
        font: negra,
        color: rgb(140 / 255, 59 / 255, 59 / 255),
        opacity: 0.07,
        rotate: degrees(24),
      });
    }
  }

  return pdf.save();
}
