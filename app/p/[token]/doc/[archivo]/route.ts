import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { listarClientesConToken } from '@/lib/airtable';
import { archivoDe } from '@/lib/servicios';

export const dynamic = 'force-dynamic';

/** La carpeta de los documentos, fuera de `public/` para que la única puerta
 *  sea esta ruta. Next la incluye en el paquete que sube a Vercel por el
 *  `outputFileTracingIncludes` de `next.config.mjs`. */
const CARPETA = path.join(process.cwd(), 'documentos');

/**
 * Documento del portal: clientes.camposhr.com/<token>/doc/<slug>.
 *
 * Resuelve el token a su empresa, busca el slug entre los documentos de esa
 * empresa y recién ahí lee el archivo y lo devuelve. El token de un cliente no
 * abre el documento de otro, y sin token no hay dirección que sirva: los
 * archivos no están publicados en ningún lado.
 *
 * Si el token no corresponde, o la empresa no tiene ese documento, responde 404
 * sin decir cuál de las dos cosas pasó.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string; archivo: string } }
) {
  const clientes = await listarClientesConToken();
  const empresaId = clientes.find((c) => c.token === params.token)?.empresaId;
  if (!empresaId) return noEncontrado();

  const archivo = archivoDe(empresaId, params.archivo);
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
      // Es el documento de un cliente: no queda en la caché de ningún
      // intermediario, sólo en el navegador de quien lo abre.
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
