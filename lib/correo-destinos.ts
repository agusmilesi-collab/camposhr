/**
 * A quién le llega cada correo del sistema.
 *
 * Lo decide la ficha del cliente, que separa dos cosas:
 *
 * - **Los avisos** (orden de compra, entrevista agendada, informe listo) son de
 *   quien solicita. Cada contacto tilda cuáles recibe y si recibe solo lo de
 *   los candidatos que pidió él o también lo que piden los demás. Va a quien
 *   pidió, y los que reciben lo de todos van en copia.
 * - **La factura y el recibo de pago** son del responsable de compras. **Si la
 *   empresa no tiene ninguno, van a quien solicitó el candidato.** Y quien
 *   solicita puede elegir en el portal, cada uno por separado: recibirlos
 *   recibirlos en copia cuando hay compras, y apagar el recibo cuando no la
 *   hay. **La factura no se puede apagar si no hay compras**: a alguien hay
 *   que mandársela. El responsable de compras recibe la factura siempre; el
 *   recibo, mientras no lo apague.
 *
 * Quien no tiene correo cargado no recibe nada, y no se le manda a otro por
 * las dudas.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { direcciones } from '@/lib/correo';

export type Aviso = 'orden' | 'entrevista' | 'informe' | 'factura' | 'recibo';

const COLUMNA: Record<Exclude<Aviso, 'factura' | 'recibo'>, string> = {
  orden: 'recibe_orden',
  entrevista: 'recibe_entrevista',
  informe: 'recibe_informe',
};

export type Destinos = {
  para: string[];
  copia: string[];
  /** El nombre de pila de a quién va, si va a uno solo. */
  nombre: string | null;
};

type Fila = {
  id: string;
  nombre: string;
  email: string | null;
  recibe_todo: boolean;
  facturacion: boolean;
} & Record<string, unknown>;

export async function destinosDe(
  aviso: Aviso,
  empresaId: string | null,
  /** Quiénes pidieron los candidatos de los que habla el correo. */
  solicitanteIds: (string | null | undefined)[]
): Promise<Destinos> {
  if (!empresaId) return { para: [], copia: [], nombre: null };
  const contactos = (
    await select<Fila>(
      'contactos',
      'select=id,nombre,email,recibe_todo,facturacion,recibe_orden,recibe_entrevista,recibe_informe,' +
        'recibe_factura,recibe_recibo' +
        `&empresa_id=eq.${empresaId}&activo=is.true&order=nombre.asc`
    )
  ).filter((c) => direcciones([c.email]).length > 0);
  const pidieron = new Set(solicitanteIds.filter(Boolean));
  const armar = (primeros: Fila[], enCopia: Fila[] = []): Destinos => {
    const para = direcciones(primeros.map((c) => c.email));
    return {
      para,
      copia: direcciones(enCopia.map((c) => c.email)).filter((x) => !para.includes(x)),
      nombre: primeros.length === 1 ? primeros[0].nombre.trim().split(/\s+/)[0] : null,
    };
  };

  // La factura y el recibo son de compras. Con compras, quien solicitó el
  // candidato los recibe en copia si lo eligió en el portal.
  //
  // Sin compras no es lo mismo para los dos (Agustín, 9/10/2026):
  // - **La factura le llega a quien solicitó sí o sí**, haya tildado lo que
  //   haya tildado: a alguien hay que mandársela.
  // - El recibo lo puede apagar: muchas veces es esa misma persona la que
  //   avisa que pagó, y ya lo sabe.
  if (aviso === 'factura' || aviso === 'recibo') {
    const todosCompras = contactos.filter((c) => c.facturacion);
    // La factura le llega siempre a compras; el recibo, salvo que lo apague.
    const compras =
      aviso === 'recibo' ? todosCompras.filter((c) => c.recibe_recibo !== false) : todosCompras;
    const marca = aviso === 'factura' ? 'recibe_factura' : 'recibe_recibo';
    const suyos = contactos.filter(
      (c) =>
        pidieron.has(c.id) &&
        !c.facturacion &&
        (todosCompras.length === 0
          ? aviso === 'factura' || c.recibe_recibo !== false
          : c[marca] === true)
    );
    return compras.length > 0 ? armar(compras, suyos) : armar(suyos);
  }

  const col = COLUMNA[aviso];
  const reciben = contactos.filter((c) => c[col] === true);
  const suyos = reciben.filter((c) => pidieron.has(c.id));
  const deTodos = reciben.filter((c) => !pidieron.has(c.id) && c.recibe_todo);
  return suyos.length > 0 ? armar(suyos, deTodos) : armar(deTodos);
}

/** El molde de todos los correos: la marca, una tarjeta blanca y el pie. */
export function hoja(adentro: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f0e6;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Helvetica,Arial,sans-serif;color:#16202b;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;margin-bottom:24px;">Campos HR</div>
  <div style="background:#ffffff;padding:28px 28px 24px;">
${adentro}
  </div>
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:20px 0 0;">www.camposhr.com</p>
</div>
</body></html>`;
}

export const PARRAFO = 'font-size:15px;line-height:1.5;margin:0 0 12px;';
export const BOTON =
  'display:inline-block;background:#16202b;color:#ffffff;text-decoration:none;font-size:14px;padding:12px 20px;';
