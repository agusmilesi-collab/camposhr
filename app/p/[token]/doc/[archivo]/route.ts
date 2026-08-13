import { NextResponse } from 'next/server';
import { getUrlDocumento } from '@/lib/airtable';
import { archivoDe } from '@/lib/servicios';

export const dynamic = 'force-dynamic';

/**
 * Documento del portal: clientes.camposhr.com/<token>/doc/<slug>.
 *
 * Los documentos del trabajo de estructura nombran a las personas del cliente,
 * así que no viven en el repositorio, que es público. Viven como adjuntos de la
 * empresa en Airtable, y esta ruta resuelve el slug a su archivo y le pregunta
 * a Airtable la dirección en el momento del clic. Las direcciones de Airtable
 * caducan, que es justamente lo que se quiere: no queda una dirección eterna
 * dando vueltas en el historial del navegador de nadie.
 *
 * Si el token no corresponde, o la empresa no tiene ese archivo, responde 404
 * sin decir cuál de las dos cosas pasó.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string; archivo: string } }
) {
  const archivo = archivoDe(params.archivo);
  if (!archivo) return noEncontrado();

  const url = await getUrlDocumento(params.token, archivo);
  if (!url) return noEncontrado();

  return NextResponse.redirect(url, {
    status: 307,
    headers: { 'x-robots-tag': 'noindex, nofollow' },
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
