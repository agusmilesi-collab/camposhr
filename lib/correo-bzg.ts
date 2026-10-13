/**
 * Las indicaciones del Benziger, por correo al candidato.
 *
 * A quien lleva Benziger la evaluadora le manda aparte, desde la plataforma de
 * Benziger, el cuestionario. Antes le avisaba por WhatsApp que le iba a llegar
 * y cómo contestarlo, con un texto que cada una escribía a su manera. Este
 * correo dice lo mismo, firmado por la evaluadora de esa entrevista.
 *
 * **Sale tres minutos después del correo con el día y la hora**
 * (`lib/correo-candidato.ts`), para que no lleguen los dos juntos y este no
 * quede tapado por el otro. La espera la hace Resend (`enMinutos`), no el
 * servidor. **Una sola vez por evaluación** (`evaluaciones.aviso_bzg_el`): si
 * la entrevista se reprograma no se repite, y si el Benziger ya está tomado no
 * sale.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { PARRAFO, hoja } from '@/lib/correo-destinos';
import { llevaBenziger } from '@/lib/benziger';
import { partesDePersona } from '@/lib/personas';

const GRIS = '#7a756b';

/** Cuánto después del correo de la entrevista sale este. */
const MINUTOS_DESPUES = 3;

export type DatosCorreoBzg = {
  /** Con qué nombre se saluda. */
  pila: string;
  /** La evaluadora: firma el correo. */
  con: string | null;
  /** Cuándo es la entrevista: el cuestionario tiene que estar hecho para ese día. */
  fecha: string | null;
};

const ZONA = 'America/Argentina/Cordoba';

/** "martes, 20 de octubre a las 11:00 hs", en la hora de acá. */
function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} a las ${hora} hs`;
}

/** Lo que se le pide en las tres preguntas que se redactan. */
const DETALLE = 'en esas te pido el mayor detalle posible.';

/** El asunto con el que llega el correo de la plataforma de Benziger. */
const ASUNTO_DE_BENZIGER = 'Bienvenido a su evaluación BZG';

/** Arma el correo, sin mandarlo: lo usa también la vista previa. */
export function armarCorreoBzg(d: DatosCorreoBzg): { asunto: string; texto: string; html: string } {
  const saludo = d.pila ? `Hola ${d.pila}:` : 'Hola:';
  const con = d.con?.trim() || null;
  // Con el asunto textual: es por lo que la persona lo va a buscar en su
  // casilla, y sin eso lo confunde con publicidad.
  const uno =
    'Como parte de la evaluación vas a recibir un cuestionario por mail. Te llega desde la ' +
    `plataforma oficial de Benziger, con el asunto "${ASUNTO_DE_BENZIGER}" y el enlace para completarlo.`;
  // El plazo es la entrevista: la evaluadora lo necesita contestado para ese
  // día. Sin fecha cargada se dice igual, sin el día.
  const dia = d.fecha ? cuando(d.fecha) : null;
  const plazo = dia
    ? `Por favor completalo antes de tu entrevista del ${dia}.`
    : 'Por favor completalo antes de tu entrevista.';
  const plazoHtml = dia
    ? `Por favor completalo antes de tu entrevista del <strong>${escapar(dia)}</strong>.`
    : escapar(plazo);
  const dos =
    'La mayoría de las preguntas son de opción múltiple. Solo tres piden redactar la respuesta: ' +
    `${DETALLE}`;
  const firma = [con, 'Campos HR'].filter(Boolean) as string[];

  return {
    asunto: 'Indicaciones BZG',
    texto: [saludo, '', uno, '', plazo, '', dos, '', ...firma].join('\n'),
    html: hoja(
        `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
        `    <p style="${PARRAFO}">${escapar(uno)}</p>\n` +
        `    <p style="${PARRAFO}">${plazoHtml}</p>\n` +
        // El pedido de detalle va subrayado: es lo único del correo que la
        // persona tiene que hacer distinto de contestar.
        `    <p style="${PARRAFO}margin-bottom:24px;">${escapar(dos).replace(
          escapar(DETALLE),
          `<u>${escapar(DETALLE)}</u>`
        )}</p>\n` +
        `    <p style="${PARRAFO}margin:0;">${con ? `<strong>${escapar(con)}</strong><br>` : ''}` +
        `<span style="color:${GRIS};">Campos HR</span></p>`
    ),
  };
}

type Fila = {
  id: string;
  con_benziger: boolean | null;
  benziger_administrado: boolean | null;
  aviso_bzg_el: string | null;
  fecha_entrevista: string | null;
  personas: {
    nombre: string;
    nombre_pila: string | null;
    apellido: string | null;
    email: string | null;
  } | null;
  evaluadoras: { nombre: string; email: string | null; telefono: string | null } | null;
  pedidos: { con_benziger: boolean | null } | null;
};

/**
 * Programa las indicaciones del Benziger, si a esa persona le corresponden.
 *
 * Lo llama el correo de la entrevista cuando sale. No tira: ese correo ya se
 * mandó y este es un agregado.
 */
export async function avisarBzg(evaluacionId: string): Promise<void> {
  try {
    if (!hayCorreo()) return;
    const [e] = await select<Fila>(
      'evaluaciones',
      'select=id,con_benziger,benziger_administrado,aviso_bzg_el,fecha_entrevista,' +
        'personas(nombre,nombre_pila,apellido,email),evaluadoras(nombre,email,telefono),' +
        `pedidos(con_benziger)&id=eq.${evaluacionId}&limit=1`
    );
    if (!e || e.aviso_bzg_el || e.benziger_administrado || !e.personas?.email) return;
    if (!llevaBenziger(e)) return;

    const envio = await enviarCorreo({
      de: 'entrevistas',
      para: [e.personas.email],
      ...armarCorreoBzg({
        pila: partesDePersona(e.personas).pila,
        con: e.evaluadoras?.nombre ?? null,
        fecha: e.fecha_entrevista,
      }),
      responderA: [e.evaluadoras?.email ?? ''],
      enMinutos: MINUTOS_DESPUES,
      clave: `bzg-${e.id}`,
    });
    if (envio.ok) {
      await patch('evaluaciones', `id=eq.${e.id}`, { aviso_bzg_el: new Date().toISOString() });
    }
  } catch (err) {
    console.error('[correo] no se pudieron mandar las indicaciones del Benziger', err);
  }
}
