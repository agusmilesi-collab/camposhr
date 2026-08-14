import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDatosCliente } from '@/lib/airtable';
import {
  datosDemo,
  esDemo,
  informeDemo,
  INFORMES_PRUEBA,
} from '@/lib/portal-demo';
import { informeDe } from '@/lib/servicios';

export const dynamic = 'force-dynamic';

/** Los informes viven al lado de los documentos del portal, fuera de `public/`.
 *  Ver la nota en lib/servicios.ts. */
const CARPETA = path.join(process.cwd(), 'documentos');

/**
 * Enlace "Ver informe" del portal: clientes.camposhr.com/<token>/informe/<id>.
 *
 * Tres controles antes de entregar el archivo: el token tiene que resolver a
 * una empresa, el candidato tiene que pertenecer a un pedido de esa empresa y
 * estar en estado Entregado, y su informe tiene que estar escrito. Si falla
 * cualquiera responde 404, sin decir cuál.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string; id: string } }
) {
  // El cliente de prueba tiene sus propios informes, escritos como archivos
  // estáticos o generados en el momento. Ver lib/portal-demo.ts.
  if (esDemo(params.token)) {
    const archivo = INFORMES_PRUEBA[params.id];
    if (archivo) {
      return NextResponse.redirect(new URL(archivo, _req.url), {
        status: 307,
        headers: { 'x-robots-tag': 'noindex, nofollow' },
      });
    }

    const cand = datosDemo()
      .busquedas.flatMap((b) => b.candidatos)
      .find((c) => c.id === params.id);
    if (!cand) return noEncontrado();
    return new NextResponse(informeDemo(cand.nombre), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  const datos = await getDatosCliente(params.token);
  if (!datos) return noEncontrado();

  const cand = datos.busquedas
    .flatMap((b) => b.candidatos)
    .find((c) => c.id === params.id && c.estado === 'Entregado');
  if (!cand) return noEncontrado();

  const archivo = informeDe(datos.empresaId, cand.nombre);
  if (!archivo) return noEncontrado();

  let html: string;
  try {
    html = await readFile(path.join(CARPETA, archivo), 'utf8');
  } catch {
    return noEncontrado();
  }

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      // Es la evaluación de una persona: no queda en la caché de ningún
      // intermediario, sólo en el navegador de quien la abre.
      'cache-control': 'private, no-store',
    },
  });
}

function noEncontrado() {
  return new NextResponse('No encontrado.', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
