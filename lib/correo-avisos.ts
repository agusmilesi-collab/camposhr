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
import { firmaDe, firmaDeQuien } from '@/lib/correo-firma';

const PORTAL = 'https://clientes.camposhr.com';

/**
 * El aviso de informe listo (Agustín, 12/11/2026): cuando la evaluadora pasa
 * la evaluación a Entregado, que es cuando el informe aparece en el portal, le
 * sale este correo a quien pidió el candidato. Lleva el botón al informe, la
 * devolución de 10 minutos incluida en el servicio y la firma de la evaluadora
 * con su foto y su WhatsApp.
 *
 * Estuvo apagado del 7/10 al 12/11/2026, mientras los informes se entregaban
 * por fuera del OS. Al prenderlo se marcaron como avisados los ya entregados
 * (respaldo en camposhr-privado/respaldo-sin-aviso-informe-2026-11-12.json),
 * para que no salieran todos juntos.
 */
const AVISA_INFORME: boolean = true;
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
  evaluadoras: { email: string | null; nombre: string | null; telefono: string | null } | null;
  pedidos: {
    puesto: string;
    empresa_id: string;
    solicitante_id: string | null;
    empresas: { token_portal: string | null; informes_visibles: boolean | null } | null;
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
        'personas(nombre),evaluadoras(email,nombre,telefono),pedidos(puesto,empresa_id,solicitante_id,empresas(token_portal,informes_visibles))' +
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
        const firma = firmaDeQuien(e.evaluadoras);
        const envio = await enviarCorreo({
          de: 'pedidos',
          para: d.para,
          copia: d.copia,
          asunto: `Entrevista ${otraVez ? 'reprogramada' : 'agendada'}: ${persona} · ${puesto}`,
          texto: [saludo, '', frase, '', ...firma.texto, 'Campos HR · www.camposhr.com'].join('\n'),
          html: hoja(
            `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
              `    <p style="${PARRAFO}margin:0;">${escapar(frase)}</p>\n` +
              firma.html
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
      token &&
      // Un cliente con los informes apagados en su ficha ve "Próximamente" en
      // el portal: el enlace del correo no abriría nada.
      e.pedidos.empresas?.informes_visibles !== false
    ) {
      const d = await destinosDe('informe', e.pedidos.empresa_id, pidio);
      if (d.para.length > 0) {
        const enlace = `${PORTAL}/p/${token}/evaluacion/${e.id}`;
        const saludo = d.nombre ? `Hola ${d.nombre}:` : 'Hola:';
        const frase = `El informe de ${persona} para el puesto ${puesto} ya está en tu portal. Desde ahí se lee y se descarga en PDF.`;
        // Firma quien hizo la evaluación: el cliente la conoce a ella.
        const quien = e.evaluadoras?.nombre?.trim();
        const firma = quien ? firmaDe(quien, e.evaluadoras?.telefono ?? null) : null;
        // La devolución incluida en el servicio (Agustín, 12/11/2026). Se
        // coordina por WhatsApp con la evaluadora; sin teléfono, respondiendo.
        const pila = persona.split(/\s+/)[0];
        const devolucion =
          `El servicio incluye una devolución de 10 minutos por videollamada para conversar sobre ${pila}; ` +
          `puede sumarse quien vaya a ser su jefe directo. ` +
          (e.evaluadoras?.telefono?.trim()
            ? 'Para coordinarla, escribime por WhatsApp.'
            : 'Para coordinarla, respondé este correo.');
        const envio = await enviarCorreo({
          de: 'pedidos',
          para: d.para,
          copia: d.copia,
          asunto: `Informe listo: ${persona} · ${puesto}`,
          texto: [saludo, '', frase, '', `Ver el informe: ${enlace}`, '', devolucion, '', ...(firma ? firma.texto : []), 'Campos HR · www.camposhr.com'].join('\n'),
          html: hoja(
            `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
              `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
              `    <p style="margin:24px 0 0;"><a href="${enlace}" style="${BOTON}">Ver el informe</a></p>\n` +
              `    <p style="${PARRAFO}margin:24px 0 0;">${escapar(devolucion)}</p>` +
              (firma ? `\n${firma.html}` : '')
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
