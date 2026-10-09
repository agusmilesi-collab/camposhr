/**
 * El correo que manda el sistema.
 *
 * Sale por Resend, con `fetch` contra su API y sin SDK, igual que Supabase.
 * Resend y no Gmail por SMTP (decisión de Agustín, 7/10/2026): es gratis para
 * este volumen, firma con el dominio y no corta la cuenta por ver entrar a un
 * servidor.
 *
 * **De parte de quién sale depende de qué es** (`REMITENTES`): lo del trabajo
 * (la orden de compra, la entrevista agendada, el informe) sale de pedidos@, y
 * lo de la plata (la factura, el recibo de pago) de facturacion@. Lo que se le
 * escribe al candidato (el día, la hora y el enlace de su entrevista) sale de
 * entrevistas@: a él nadie le hizo un pedido. Así el
 * cliente distingue de un vistazo lo operativo de lo administrativo y compras
 * puede filtrar las facturas por remitente. Son direcciones del dominio
 * verificado en Resend; no hace falta que exista la casilla, porque la
 * respuesta va a la evaluadora.
 *
 * Tres variables, y solo la primera es obligatoria:
 *
 *   RESEND_API_KEY       la clave. **Sin ella no se manda nada** y el resto del
 *                        sistema sigue igual: `enviarCorreo` contesta "apagado".
 *   CORREO_RESPONDER_A   a dónde cae la respuesta del cliente cuando el correo no
 *                        dice a quién. Lo normal es que lo diga: cada aviso
 *                        responde a la evaluadora de ese trabajo
 *                        (`evaluadoras.email`). El dominio no recibe correo.
 *   CORREO_SOLO_A        para probar: todo lo que salga va a esta dirección y a
 *                        ninguna otra. Local usa la misma base que producción,
 *                        y sin esto una prueba le escribe a un cliente real.
 */

import 'server-only';
import { DIRECCION } from '@/lib/direccion';

const REMITENTES = {
  pedidos: 'Campos HR <pedidos@camposhr.com>',
  facturacion: 'Campos HR <facturacion@camposhr.com>',
  entrevistas: 'Campos HR <entrevistas@camposhr.com>',
} as const;

export type Adjunto = { nombre: string; bytes: Uint8Array };

export type Correo = {
  /** De qué casilla sale: lo del trabajo, lo de la plata, o lo del candidato. */
  de: keyof typeof REMITENTES;
  para: string[];
  copia?: string[];
  asunto: string;
  html: string;
  texto: string;
  adjuntos?: Adjunto[];
  /**
   * A quién le cae la respuesta: la evaluadora que lleva ese trabajo. Sin esto
   * se usa `CORREO_RESPONDER_A`.
   */
  responderA?: string[];
  /**
   * Lo que hace que el mismo aviso no salga dos veces: Resend descarta un
   * segundo envío con la misma clave durante 24 horas.
   */
  clave: string;
};

export type Envio =
  | { ok: true; id: string; a: string[] }
  | { ok: false; motivo: 'apagado' | 'sin destinatario' | 'rechazado'; detalle?: string };

/** Las direcciones bien escritas, sin repetir. */
export function direcciones(lista: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      lista
        .map((x) => (x ?? '').trim().toLowerCase())
        .filter((x) => DIRECCION.test(x))
    ),
  ];
}

export const hayCorreo = () => Boolean(process.env.RESEND_API_KEY);

/**
 * Manda un correo. No tira nunca: un aviso que no sale no puede voltear lo que
 * lo disparó (una carga de candidatos, una factura ya autorizada).
 */
export async function enviarCorreo(c: Correo): Promise<Envio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { ok: false, motivo: 'apagado' };

  const soloA = direcciones([process.env.CORREO_SOLO_A]);
  const para = soloA.length > 0 ? soloA : direcciones(c.para);
  const copia = soloA.length > 0 ? [] : direcciones(c.copia ?? []).filter((x) => !para.includes(x));
  if (para.length === 0) return { ok: false, motivo: 'sin destinatario' };

  const deQuien = direcciones(c.responderA ?? []);
  const responderA = deQuien.length > 0 ? deQuien : direcciones([process.env.CORREO_RESPONDER_A]);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': c.clave.slice(0, 256),
      },
      body: JSON.stringify({
        from: REMITENTES[c.de],
        to: para,
        ...(copia.length > 0 ? { cc: copia } : {}),
        ...(responderA.length > 0 ? { reply_to: responderA } : {}),
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        attachments: (c.adjuntos ?? []).map((a) => ({
          filename: a.nombre,
          content: Buffer.from(a.bytes).toString('base64'),
        })),
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const detalle = `${res.status}: ${await res.text()}`;
      console.error('[correo] Resend lo rechazó', detalle);
      return { ok: false, motivo: 'rechazado', detalle };
    }
    const { id } = (await res.json()) as { id: string };
    return { ok: true, id, a: [...para, ...copia] };
  } catch (e) {
    console.error('[correo] no se pudo mandar', e);
    return { ok: false, motivo: 'rechazado', detalle: String(e) };
  }
}

/** Para meter un dato de la base adentro del HTML del correo. */
export const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
