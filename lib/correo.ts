/**
 * El correo que manda el sistema.
 *
 * Sale por Resend, con `fetch` contra su API y sin SDK, igual que Supabase.
 * Resend y no Gmail por SMTP (decisión de Agustín, 7/10/2026): es gratis para
 * este volumen, firma con el dominio y no corta la cuenta por ver entrar a un
 * servidor.
 *
 * Cuatro variables, y solo la primera es obligatoria:
 *
 *   RESEND_API_KEY       la clave. **Sin ella no se manda nada** y el resto del
 *                        sistema sigue igual: `enviarCorreo` contesta "apagado".
 *   CORREO_REMITENTE     de parte de quién. Tiene que ser del dominio verificado.
 *   CORREO_RESPONDER_A   a dónde cae la respuesta del cliente cuando el correo no
 *                        dice a quién. Lo normal es que lo diga: cada aviso
 *                        responde a la evaluadora de ese trabajo
 *                        (`evaluadoras.email`). El dominio no recibe correo.
 *   CORREO_SOLO_A        para probar: todo lo que salga va a esta dirección y a
 *                        ninguna otra. Local usa la misma base que producción,
 *                        y sin esto una prueba le escribe a un cliente real.
 */

import 'server-only';

const REMITENTE = 'Campos HR <facturacion@camposhr.com>';
const DIRECCION = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export type Adjunto = { nombre: string; bytes: Uint8Array };

export type Correo = {
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
        from: process.env.CORREO_REMITENTE || REMITENTE,
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
