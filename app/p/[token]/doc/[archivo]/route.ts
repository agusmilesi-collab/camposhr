import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { archivoDe } from '@/lib/servicios';
import { leerDocumento } from '@/lib/documentos-portal';

export const dynamic = 'force-dynamic';

/**
 * Documento del portal: clientes.camposhr.com/<token>/doc/<slug>.
 *
 * Resuelve el token a su empresa, busca el slug entre los documentos de esa
 * empresa y recién ahí lee el archivo y lo devuelve. El token de un cliente no
 * abre el documento de otro, y sin token no hay dirección que sirva: los
 * archivos están en el bucket privado. Ver lib/documentos-portal.ts.
 *
 * Si el token no corresponde, o la empresa no tiene ese documento, responde 404
 * sin decir cuál de las dos cosas pasó.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string; archivo: string } }
) {
  const empresaId = (await empresaDelToken(params.token))?.id;
  if (!empresaId) return noEncontrado();

  const archivo = archivoDe(empresaId, params.archivo);
  if (!archivo) return noEncontrado();

  const html = await leerDocumento(archivo);
  if (html === null) return noEncontrado();

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
