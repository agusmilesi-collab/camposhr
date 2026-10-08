/**
 * El aviso al equipo de que entró un pedido por el portal.
 *
 * Cuando un cliente carga candidatos desde su portal, les llega un correo a
 * todas las evaluadoras activas: el pedido entra sin dueña, y hasta ahora se
 * enteraban recién al abrir el OS.
 *
 * Solo lo que entra por el portal. Lo que carga el equipo desde el OS no avisa:
 * quien lo cargó ya lo sabe.
 *
 * Lleva el nombre de cada candidato y ningún otro dato suyo: el teléfono, el
 * correo y el CV se miran en el OS, con sesión.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { direcciones, enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { BOTON, PARRAFO, hoja } from '@/lib/correo-destinos';

const OS = 'https://os.camposhr.com';

type Fila = {
  id: string;
  personas: { nombre: string } | null;
  solicitante: { nombre: string } | null;
  pedidos: {
    id: string;
    puesto: string;
    empresas: { nombre: string } | null;
    baterias: { nombre: string } | null;
    solicitante: { nombre: string } | null;
  } | null;
};

/** No tira: los candidatos ya entraron cuando esto corre. */
export async function avisarPedidoNuevo(evaluacionIds: string[]): Promise<void> {
  try {
    if (!hayCorreo() || evaluacionIds.length === 0) return;
    const [filas, evaluadoras] = await Promise.all([
      select<Fila>(
        'evaluaciones',
        'select=id,personas(nombre),solicitante:contactos!solicitante_id(nombre),' +
          'pedidos(id,puesto,empresas(nombre),baterias(nombre),solicitante:contactos!solicitante_id(nombre))' +
          `&id=in.(${evaluacionIds.join(',')})`
      ),
      select<{ email: string | null }>('evaluadoras', 'select=email&activa=is.true'),
    ]);
    const para = direcciones(evaluadoras.map((e) => e.email));
    // En el orden en que el cliente los cargó.
    const cargados = evaluacionIds
      .map((id) => filas.find((f) => f.id === id))
      .filter((f): f is Fila => Boolean(f?.pedidos));
    if (para.length === 0 || cargados.length === 0) return;

    const pedido = cargados[0].pedidos!;
    const empresa = pedido.empresas?.nombre?.trim() ?? 'un cliente';
    const puesto = pedido.puesto.trim();
    const pidio = cargados[0].solicitante?.nombre ?? pedido.solicitante?.nombre ?? null;
    const nombres = cargados.map((f) => f.personas?.nombre?.trim() ?? 'sin nombre');
    const cuantos = nombres.length === 1 ? '1 candidato' : `${nombres.length} candidatos`;
    // A Entrevistas, que es donde se reparten: entran en la primera columna.
    const enlace = `${OS}/os/psicotecnicos/entrevistas`;

    const frase =
      `${empresa} cargó ${cuantos} para el puesto ${puesto}` +
      (pedido.baterias?.nombre ? `, con ${pedido.baterias.nombre}` : '') +
      (pidio ? `. Lo pidió ${pidio}.` : '.');
    const sigue = 'Están sin asignar, en la primera columna de Entrevistas.';

    await enviarCorreo({
      de: 'pedidos',
      para,
      asunto: `Pedido nuevo: ${empresa} · ${puesto} (${cuantos})`,
      texto: [
        frase,
        '',
        nombres.length === 1 ? 'Candidato' : 'Candidatos',
        ...nombres.map((n) => `- ${n}`),
        '',
        sigue,
        '',
        `Ir a Entrevistas: ${enlace}`,
      ].join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
          `    <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:20px 0 6px;">` +
          `${nombres.length === 1 ? 'Candidato' : 'Candidatos'}</p>\n` +
          `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">` +
          nombres
            .map(
              (n) =>
                `<tr><td style="padding:9px 0;border-bottom:1px solid #e6e1d6;font-size:15px;font-weight:bold;">${escapar(n)}</td></tr>`
            )
            .join('') +
          `</table>\n` +
          `    <p style="${PARRAFO}color:#7a756b;">${escapar(sigue)}</p>\n` +
          `    <p style="margin:20px 0 0;"><a href="${enlace}" style="${BOTON}">Ir a Entrevistas</a></p>`
      ),
      clave: `pedido-nuevo-${evaluacionIds[0]}`,
    });
  } catch (e) {
    console.error('[aviso de pedido nuevo]', e);
  }
}
