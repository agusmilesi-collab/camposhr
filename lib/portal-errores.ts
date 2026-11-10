import 'server-only';
import { insert, select } from '@/lib/supabase';
import { enviarCorreo, escapar } from '@/lib/correo';
import { PARRAFO, hoja } from '@/lib/correo-destinos';

/**
 * Lo que falló cuando un cliente cargaba un pedido desde su portal.
 *
 * Queda en `portal_errores` (`supabase/portal-errores.sql`) y le llega un
 * correo a Agustín, a la dirección de `CORREO_ERRORES`: los registros de
 * Vercel duran una hora y el cliente no siempre avisa. La dirección va en una
 * variable y no acá, que el repositorio es público.
 *
 * Solo fallas del sistema. Lo que el formulario le pide corregir al cliente
 * (falta el apellido, falta un teléfono) no se registra: no es un error, es el
 * formulario haciendo su trabajo.
 */

export type Paso = 'subida' | 'lectura' | 'pedido';

const PASOS: Record<Paso, string> = {
  subida: 'Subir un archivo',
  lectura: 'Leer los CV',
  pedido: 'Guardar el pedido',
};

export const esPaso = (x: unknown): x is Paso => typeof x === 'string' && x in PASOS;

/** No tira nunca: registrar la falla no puede ser una segunda falla. */
export async function registrarError(e: {
  empresaId: string | null;
  paso: Paso;
  motivo: string;
  detalle?: Record<string, unknown>;
}): Promise<void> {
  const motivo = e.motivo.slice(0, 500);
  let id = '';
  try {
    const fila = await insert<{ id: string }>('portal_errores', {
      empresa_id: e.empresaId,
      paso: e.paso,
      motivo,
      detalle: e.detalle ?? null,
    });
    id = fila?.id ?? '';
  } catch (err) {
    console.error('[portal_errores] no se pudo guardar', err);
  }

  try {
    const para = process.env.CORREO_ERRORES;
    if (!para) return;
    const empresa = e.empresaId
      ? (
          await select<{ nombre: string }>(
            'empresas',
            `select=nombre&id=eq.${e.empresaId}&limit=1`
          ).catch(() => [])
        )[0]?.nombre ?? 'un cliente'
      : 'un cliente';
    const cuando = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());
    const frase = `${empresa} no pudo completar un paso del pedido en su portal (${cuando}).`;
    const detalle = e.detalle ? JSON.stringify(e.detalle, null, 2) : '';

    await enviarCorreo({
      de: 'pedidos',
      para: [para],
      asunto: `Error en el portal: ${empresa} · ${PASOS[e.paso]}`,
      texto: [frase, '', `Paso: ${PASOS[e.paso]}`, `Qué pasó: ${motivo}`, '', detalle].join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
          `    <p style="${PARRAFO}"><b>Paso:</b> ${escapar(PASOS[e.paso])}<br>` +
          `<b>Qué pasó:</b> ${escapar(motivo)}</p>\n` +
          (detalle
            ? `    <pre style="font-size:12px;line-height:1.4;background:#f7f4ec;padding:12px 14px;white-space:pre-wrap;margin:0;">${escapar(detalle)}</pre>\n`
            : '')
      ),
      clave: `portal-error-${id || Date.now()}`,
    });
  } catch (err) {
    console.error('[portal_errores] no se pudo avisar', err);
  }
}
