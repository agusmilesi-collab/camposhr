/**
 * El correo al candidato con el día, la hora y el lugar de su entrevista.
 *
 * Sale solo cuando la entrevista queda agendada, y dice dónde según la
 * modalidad:
 *
 * - **Presencial**: la dirección del consultorio (`lib/consultorio.ts`).
 * - **Online**: el enlace de la sala de Meet. La sala la crea el evento del
 *   calendario de la evaluadora (`lib/google-calendario.ts`), así que sin su
 *   Google conectado no hay enlace y el correo no sale: una confirmación de
 *   videollamada sin por dónde entrar no le sirve a nadie.
 *
 * **Sale una vez por fecha**, igual que el aviso al cliente:
 * `evaluaciones.aviso_candidato_fecha` guarda para qué fecha se avisó. Si la
 * entrevista se reprograma sale de nuevo y lo dice; la sala es la misma.
 *
 * La respuesta del candidato cae en la evaluadora, que es con quien coordinó.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { BOTON, PARRAFO, hoja } from '@/lib/correo-destinos';
import { CONSULTORIO } from '@/lib/consultorio';

const ZONA = 'America/Argentina/Cordoba';

type Fila = {
  id: string;
  estado: string;
  modalidad: string | null;
  fecha_entrevista: string | null;
  baja_el: string | null;
  enlace_meet: string | null;
  aviso_candidato_fecha: string | null;
  personas: { nombre: string; email: string | null } | null;
  evaluadoras: { nombre: string; email: string | null } | null;
  pedidos: { puesto: string } | null;
};

/** "martes 14 de octubre a las 10:30", en la hora de acá. */
function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} a las ${hora}`;
}

const mismoMomento = (a: string | null, b: string | null) =>
  Boolean(a && b) && new Date(a as string).getTime() === new Date(b as string).getTime();

/**
 * Mira cómo quedó la evaluación y le escribe al candidato si corresponde. No
 * tira: el cambio de la evaluadora ya está guardado cuando esto corre.
 */
export async function avisarAlCandidato(evaluacionId: string): Promise<void> {
  try {
    if (!hayCorreo()) return;
    const [e] = await select<Fila>(
      'evaluaciones',
      'select=id,estado,modalidad,fecha_entrevista,baja_el,enlace_meet,aviso_candidato_fecha,' +
        'personas(nombre,email),evaluadoras(nombre,email),pedidos(puesto)' +
        `&id=eq.${evaluacionId}&limit=1`
    );
    if (
      !e ||
      e.baja_el ||
      e.estado !== 'Por entrevistar' ||
      (e.modalidad !== 'Presencial' && !(e.modalidad === 'Online' && e.enlace_meet)) ||
      !e.fecha_entrevista ||
      !e.personas?.email ||
      new Date(e.fecha_entrevista).getTime() <= Date.now() ||
      mismoMomento(e.fecha_entrevista, e.aviso_candidato_fecha)
    ) {
      return;
    }

    const otraVez = Boolean(e.aviso_candidato_fecha);
    const pila = e.personas.nombre.trim().split(/\s+/)[0];
    const puesto = e.pedidos?.puesto?.trim();
    const con = e.evaluadoras?.nombre?.trim();
    const saludo = pila ? `Hola ${pila}:` : 'Hola:';
    const frase =
      `Tu entrevista con Campos HR${puesto ? ` para el puesto ${puesto}` : ''} ` +
      `${otraVez ? 'se reprogramó' : 'quedó agendada'} para el ${cuando(e.fecha_entrevista)}, hora de Argentina.`;
    const online = e.modalidad === 'Online' && e.enlace_meet ? e.enlace_meet : null;
    const como = online
      ? `Es por videollamada de Google Meet${con ? `, con ${con}` : ''}. ` +
        'Se entra con este enlace desde una computadora con cámara y micrófono:'
      : `Es presencial${con ? `, con ${con}` : ''}, en ${CONSULTORIO}.`;
    const cambio = 'Para cambiar el día o la hora, respondé este correo.';

    const envio = await enviarCorreo({
      de: 'entrevistas',
      para: [e.personas.email],
      asunto: `Tu entrevista con Campos HR${otraVez ? ' se reprogramó' : ''}: ${cuando(e.fecha_entrevista)}`,
      texto: [saludo, '', frase, '', como, ...(online ? [online] : []), '', cambio, '', 'Campos HR · www.camposhr.com'].join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
          `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
          `    <p style="${PARRAFO}">${escapar(como)}</p>\n` +
          (online
            ? `    <p style="${PARRAFO}"><a href="${escapar(online)}" style="${BOTON}">Entrar a la videollamada</a></p>\n` +
              `    <p style="${PARRAFO}">${escapar(online)}</p>\n`
            : '') +
          `    <p style="${PARRAFO}margin:0;">${escapar(cambio)}</p>`
      ),
      responderA: [e.evaluadoras?.email ?? ''],
      // La modalidad entra en la clave: si pasa de online a presencial el
      // mismo día, el segundo correo no es un duplicado del primero.
      clave: `candidato-${e.id}-${new Date(e.fecha_entrevista).getTime()}-${online ? 'online' : 'presencial'}`,
    });
    if (envio.ok) {
      await patch('evaluaciones', `id=eq.${e.id}`, { aviso_candidato_fecha: e.fecha_entrevista });
    }
  } catch (err) {
    console.error('[correo] no se pudo avisar al candidato', err);
  }
}
