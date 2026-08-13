import { NextResponse } from 'next/server';
import { getUrlInforme } from '@/lib/airtable';
import {
  datosDemo,
  esDemo,
  informeDemo,
  INFORMES_PRUEBA,
} from '@/lib/portal-demo';

export const dynamic = 'force-dynamic';

/**
 * Interruptor de la descarga. En false la ruta responde 404 aunque el token y
 * el candidato sean correctos: la pantalla todavía dice "Próximamente" y no
 * tiene sentido dejar una vía abierta que entregue informes. Se pone en true
 * el día que el botón lleve al PDF.
 */
const DESCARGA_ABIERTA = false;

/**
 * Enlace "Ver informe" del portal: clientes.camposhr.com/<token>/informe/<id>.
 *
 * No sirve el archivo ni guarda su dirección: pregunta a Airtable en el momento
 * si ese candidato es del cliente del token y ya tiene el informe entregado, y
 * recién ahí redirige al PDF. Si el token no corresponde o el candidato es de
 * otro cliente, responde 404 sin decir por qué.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string; id: string } }
) {
  // El cliente de prueba va antes del interruptor a propósito: `esDemo` ya es
  // false en producción, así que abrirle la descarga no abre nada real. Es lo
  // que permite recorrer el circuito completo en localhost mientras el botón
  // de los clientes de verdad sigue diciendo "Próximamente".
  if (esDemo(params.token)) {
    // Los candidatos que viven en Airtable tienen su informe escrito como
    // archivo; los inventados en código siguen con la página de muestra.
    const archivo = INFORMES_PRUEBA[params.id];
    if (archivo) {
      return NextResponse.redirect(new URL(archivo, _req.url), {
        status: 307,
        headers: { 'x-robots-tag': 'noindex, nofollow' },
      });
    }

    const cand = datosDemo()
      .busquedas.flatMap((b) => b.candidatos)
      .find((c) => c.id === params.id && c.tieneInforme);
    if (!cand) return noEncontrado();
    return new NextResponse(informeDemo(cand.nombre), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  if (!DESCARGA_ABIERTA) return noEncontrado();

  const url = await getUrlInforme(params.token, params.id);
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
