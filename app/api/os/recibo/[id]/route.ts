import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { verFactura } from '@/lib/facturas';
import { formatoFecha } from '@/lib/facturas-tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El recibo de lo que se cobra sin factura, en PDF y para bajar.
 *
 * Es un papel para el cliente con el detalle de lo hecho y lo que sale. **No es
 * un comprobante fiscal y lo dice arriba**: no lleva CUIT, número ni CAE, que
 * son de una factura, y por eso tampoco usa la hoja del comprobante.
 *
 * Se dibuja con `pdf-lib` y no imprimiendo una página: tiene que bajarse solo
 * al apretar el botón, sin pasar por el diálogo de impresión.
 */

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

/** Las fuentes de base del PDF no traen todos los signos: lo que no entra, se saca. */
const limpio = (t: string) => t.replace(/[^\x20-\x7E -ÿ]/g, '');

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  const f = await verFactura(params.id);
  if (!f || !f.sinComprobante) {
    return NextResponse.json({ error: 'Ese recibo no existe.' }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const hoja = pdf.addPage([595.28, 841.89]); // A4
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negra = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.086, 0.125, 0.169);
  const gris = rgb(0.42, 0.45, 0.49);
  const linea = rgb(0.85, 0.83, 0.79);

  const IZQ = 56;
  const DER = 595.28 - 56;
  const ANCHO = DER - IZQ;
  let y = 841.89 - 64;

  const texto = (
    t: string,
    x: number,
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
  const raya = (grosor = 0.6, color = linea) => {
    hoja.drawLine({ start: { x: IZQ, y }, end: { x: DER, y }, thickness: grosor, color });
  };

  texto('CAMPOS HR', IZQ, 20, { fuente: negra });
  texto('Recibo', DER, 20, { fuente: negra, derecha: true });
  y -= 18;
  texto('Documento no válido como factura', DER, 10, { color: gris, derecha: true });
  y -= 16;
  raya(1.4, tinta);

  y -= 28;
  const dato = (rotulo: string, valor: string) => {
    texto(rotulo, IZQ, 9.5, { color: gris });
    for (const r of partir(valor, negra, 10.5, ANCHO - 110)) {
      texto(r, IZQ + 110, 10.5, { fuente: negra });
      y -= 15;
    }
    y -= 3;
  };
  dato('Fecha', formatoFecha(f.fecha));
  dato('Cliente', f.cliente);
  if (f.concepto) dato('Concepto', f.concepto);
  if (f.ordenCompra) dato('Orden de compra', f.ordenCompra);

  y -= 14;
  texto('Detalle', IZQ, 9.5, { color: gris });
  texto('Importe', DER, 9.5, { color: gris, derecha: true });
  y -= 8;
  raya();

  const renglones =
    f.renglones.length > 0
      ? f.renglones
      : [{ descripcion: f.concepto ?? 'Servicios profesionales', detalle: null, importe: f.importe }];
  for (const r of renglones) {
    y -= 20;
    const partes = partir(r.descripcion, normal, 10.5, ANCHO - 120);
    texto(partes[0], IZQ, 10.5);
    if (r.importe !== null) texto(pesos(r.importe), DER, 10.5, { derecha: true });
    for (const resto of partes.slice(1)) {
      y -= 14;
      texto(resto, IZQ, 10.5);
    }
    if (r.detalle) {
      for (const d of partir(r.detalle, normal, 9, ANCHO - 120)) {
        y -= 13;
        texto(d, IZQ, 9, { color: gris });
      }
    }
    y -= 10;
    raya();
  }

  const total = f.renglones.reduce((n, r) => n + (r.importe ?? 0), 0) || f.importe || 0;
  y -= 30;
  texto('Total', DER - 150, 13, { fuente: negra });
  texto(pesos(total), DER, 13, { fuente: negra, derecha: true });

  y = 64;
  texto('Este documento detalla el servicio prestado y su importe. No es un comprobante fiscal.', IZQ, 8.5, {
    color: gris,
  });

  const bytes = await pdf.save();
  const nombre = limpio(`Recibo ${f.cliente} ${f.fecha.slice(0, 10)}`).replace(/[^\w\- ]+/g, '').trim();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
