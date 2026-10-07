/**
 * Los dos avisos que salen del trabajo de la evaluadora: la entrevista quedó
 * agendada, y el informe está en el portal.
 *
 * Salen solos, después de guardar un cambio en una evaluación, mirando cómo
 * quedó y no qué se tocó: así da lo mismo si se agendó con el botón, arrastrando
 * la tarjeta o desde la ficha.
 *
 * **Cada uno sale una vez.** La evaluación guarda para qué fecha se avisó la
 * entrevista y cuándo se avisó el informe. Llevar la tarjeta ida y vuelta entre
 * columnas no manda nada; cambiar la fecha de una entrevista ya avisada sí, y
 * el correo dice que se reprogramó.
 *
 * A quién van lo decide la ficha del cliente (`lib/correo-destinos.ts`).
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { BOTON, PARRAFO, destinosDe, hoja } from '@/lib/correo-destinos';

const PORTAL = 'https://clientes.camposhr.com';

/**
 * El aviso de informe listo está apagado (Agustín, 7/10/2026).
 *
 * Los informes todavía se hacen por fuera del OS y se mandan a mano; el portal
 * dice "próximamente" donde iría el informe. Avisar con un enlace ahí sería
 * mandar al cliente a una página vacía. Se prende el día que los informes del
 * OS sean los que se entregan. Mientras tanto no se anota nada como avisado:
 * al prenderlo hay que marcar antes lo ya entregado, o salen todos juntos.
 */
const AVISA_INFORME: boolean = false;
const ZONA = 'America/Argentina/Cordoba';

type Fila = {
  id: string;
  estado: string;
  modalidad: string | null;
  fecha_entrevista: string | null;
  baja_el: string | null;
  aviso_entrevista_fecha: string | null;
  aviso_informe_at: string | null;
  solicitante_id: string | null;
  personas: { nombre: string } | null;
  evaluadoras: { email: string | null } | null;
  pedidos: {
    puesto: string;
    empresa_id: string;
    solicitante_id: string | null;
    empresas: { token_portal: string | null } | null;
  } | null;
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
 * Mira cómo quedó la evaluación y manda lo que corresponda. No tira: el cambio
 * de la evaluadora ya está guardado cuando esto corre.
 */
export async function avisarSiCorresponde(evaluacionId: string): Promise<void> {
  try {
    if (!hayCorreo()) return;
    const [e] = await select<Fila>(
      'evaluaciones',
      'select=id,estado,modalidad,fecha_entrevista,baja_el,aviso_entrevista_fecha,aviso_informe_at,solicitante_id,' +
        'personas(nombre),evaluadoras(email),pedidos(puesto,empresa_id,solicitante_id,empresas(token_portal))' +
        `&id=eq.${evaluacionId}&limit=1`
    );
    if (!e?.pedidos || e.baja_el) return;

    const persona = e.personas?.nombre?.trim() ?? 'el candidato';
    const puesto = e.pedidos.puesto.trim();
    const pidio = [e.solicitante_id ?? e.pedidos.solicitante_id];
    const responderA = [e.evaluadoras?.email ?? ''];

    // La entrevista: agendada, con día y modalidad, todavía por venir, y sin
    // haber avisado ya esa misma fecha.
    if (
      e.estado === 'Por entrevistar' &&
      e.fecha_entrevista &&
      e.modalidad &&
      new Date(e.fecha_entrevista).getTime() > Date.now() &&
      !mismoMomento(e.fecha_entrevista, e.aviso_entrevista_fecha)
    ) {
      const d = await destinosDe('entrevista', e.pedidos.empresa_id, pidio);
      if (d.para.length > 0) {
        const otraVez = Boolean(e.aviso_entrevista_fecha);
        const saludo = d.nombre ? `Hola ${d.nombre}:` : 'Hola:';
        const frase =
          `La entrevista de ${persona} para el puesto ${puesto} ` +
          `${otraVez ? 'se reprogramó' : 'quedó agendada'} para el ${cuando(e.fecha_entrevista)}, ` +
          `modalidad ${e.modalidad.toLowerCase()}.`;
        const envio = await enviarCorreo({
          para: d.para,
          copia: d.copia,
          asunto: `Entrevista ${otraVez ? 'reprogramada' : 'agendada'}: ${persona} · ${puesto}`,
          texto: [saludo, '', frase, '', 'Campos HR · www.camposhr.com'].join('\n'),
          html: hoja(
            `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
              `    <p style="${PARRAFO}margin:0;">${escapar(frase)}</p>`
          ),
          responderA,
          clave: `entrevista-${e.id}-${new Date(e.fecha_entrevista).getTime()}`,
        });
        if (envio.ok) {
          await patch('evaluaciones', `id=eq.${e.id}`, { aviso_entrevista_fecha: e.fecha_entrevista });
        }
      }
    }

    // El informe: entregado, que es cuando aparece en el portal, y sin haberlo
    // avisado. Sin portal no hay a dónde mandar a leerlo y no se avisa.
    const token = e.pedidos.empresas?.token_portal;
    if (
      AVISA_INFORME &&
      (e.estado === 'Entregado' || e.estado === 'Seguimiento') &&
      !e.aviso_informe_at &&
      token
    ) {
      const d = await destinosDe('informe', e.pedidos.empresa_id, pidio);
      if (d.para.length > 0) {
        const enlace = `${PORTAL}/${token}/evaluacion/${e.id}`;
        const saludo = d.nombre ? `Hola ${d.nombre}:` : 'Hola:';
        const frase = `El informe de ${persona} para el puesto ${puesto} ya está en tu portal. Desde ahí se lee y se descarga en PDF.`;
        const envio = await enviarCorreo({
          para: d.para,
          copia: d.copia,
          asunto: `Informe listo: ${persona} · ${puesto}`,
          texto: [saludo, '', frase, '', `Ver el informe: ${enlace}`, '', 'Campos HR · www.camposhr.com'].join('\n'),
          html: hoja(
            `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
              `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
              `    <p style="margin:24px 0 0;"><a href="${enlace}" style="${BOTON}">Ver el informe</a></p>`
          ),
          responderA,
          clave: `informe-${e.id}`,
        });
        if (envio.ok) {
          await patch('evaluaciones', `id=eq.${e.id}`, { aviso_informe_at: new Date().toISOString() });
        }
      }
    }
  } catch (err) {
    console.error('[avisos por correo]', err);
  }
}
