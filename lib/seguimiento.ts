/**
 * El seguimiento a los noventa días, preguntado por correo.
 *
 * Cuando alguien que ingresó cumple noventa días (`seguimiento_al`, que agenda
 * la ficha al cargar desde cuándo trabaja), el aviso diario
 * (`app/api/cron/seguimiento/route.ts`) le escribe a quien pidió la búsqueda
 * con un enlace a `camposhr.com/seguimiento/<token>`. Ahí contesta tres
 * preguntas de opción múltiple y deja un comentario si quiere
 * (`lib/seguimiento-preguntas.ts`).
 *
 * **A quién va** lo decide `destinosDe('seguimiento')`: quien pidió, y si no
 * hay, los contactos que reciben lo de todos. Sin ninguno no sale: queda
 * anotado en la ficha y se vuelve a intentar al día siguiente, por si alguien
 * cargó el contacto.
 *
 * **Sale una vez, y un recordatorio a los siete días** si nadie contestó.
 * `seguimiento_enviado_el` y `seguimiento_recordado_el` lo marcan; mientras
 * estén vacíos el aviso diario lo vuelve a intentar. El enlace se crea con el primer intento y
 * no cambia, así un reintento no deja inservible un correo anterior.
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { patch, select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { enviarCorreo, escapar } from '@/lib/correo';
import { PARRAFO, destinosDe, hoja } from '@/lib/correo-destinos';
import { esEmpresaDePrueba } from '@/lib/empresa-prueba';
import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import { partesDePersona } from '@/lib/personas';
import {
  EN_EL_CORREO,
  LARGO_COMENTARIO,
  PREGUNTAS_SEGUIMIENTO,
  resultadoDelSeguimiento,
} from '@/lib/seguimiento-preguntas';

/** Donde vive la página de las preguntas. En local se cambia con `SITIO_CANDIDATO`. */
const SITIO = (process.env.SITIO_CANDIDATO || 'https://camposhr.com').replace(/\/$/, '');

export const TOKEN_SEGUIMIENTO = /^sg_[A-Za-z0-9_-]{16,64}$/;

type Vencido = {
  id: string;
  solicitante_id: string | null;
  seguimiento_token: string | null;
  seguimiento_enviado_el: string | null;
  fecha_ingreso_empresa: string | null;
  personas: { nombre: string; nombre_pila: string | null; apellido: string | null } | null;
  evaluadoras: { email: string | null } | null;
  pedidos: {
    puesto: string;
    empresa_id: string;
    solicitante_id: string | null;
    empresas: { nombre: string } | null;
  } | null;
};

/**
 * Los que cumplen noventa días al día de hoy y todavía no se les preguntó.
 *
 * La empresa de prueba entra solo fuera de producción: ahí se prueba con
 * `CORREO_SOLO_A`, y en producción sus contactos inventados no tienen que
 * recibir nada. La del portal de muestra no entra nunca.
 */
export async function vencidos(dia: string): Promise<Vencido[]> {
  return leer(`&seguimiento_al=lte.${dia}&seguimiento_enviado_el=is.null&order=seguimiento_al.asc`);
}

/** Cuántos días después del primer correo sale el recordatorio, si nadie contestó. */
export const DIAS_RECORDATORIO = 7;

/**
 * A los que se les preguntó hace siete días o más, nadie contestó y todavía no
 * se les recordó. El recordatorio sale una sola vez.
 */
export async function porRecordar(ahora = new Date()): Promise<Vencido[]> {
  const limite = new Date(ahora.getTime() - DIAS_RECORDATORIO * 86_400_000).toISOString();
  return leer(
    `&seguimiento_enviado_el=lte.${encodeURIComponent(limite)}&seguimiento_recordado_el=is.null&order=seguimiento_enviado_el.asc`
  );
}

/** Lo común a las dos listas: ingresó, sigue en seguimiento, sin baja y sin respuesta. */
async function leer(filtro: string): Promise<Vencido[]> {
  const filas = await select<Vencido>(
    'evaluaciones',
    'select=id,solicitante_id,seguimiento_token,seguimiento_enviado_el,fecha_ingreso_empresa,' +
      'personas(nombre,nombre_pila,apellido),evaluadoras(email),' +
      'pedidos(puesto,empresa_id,solicitante_id,empresas(nombre))' +
      '&ingreso=is.true&estado=eq.Seguimiento&baja_el=is.null&seguimiento_respondido_el=is.null' +
      filtro
  );
  const produccion = process.env.VERCEL_ENV === 'production';
  return filas.filter((f) => {
    const empresa = f.pedidos?.empresas?.nombre;
    if (!f.pedidos || esEmpresaEjemplo(empresa)) return false;
    return !(produccion && esEmpresaDePrueba(empresa));
  });
}

export type Resultado =
  | { estado: 'enviado'; a: string[] }
  | { estado: 'sin destino' }
  | { estado: 'falló'; motivo: string };

/**
 * Le escribe a quien corresponde, o deja anotado que no había a quién.
 *
 * Con `recordatorio`, es el segundo y último correo: mismo enlace y mismos
 * destinatarios, con un texto que dice que ya se le escribió.
 */
export async function preguntar(e: Vencido, recordatorio = false): Promise<Resultado> {
  const pedido = e.pedidos!;
  const d = await destinosDe('seguimiento', pedido.empresa_id, [e.solicitante_id ?? pedido.solicitante_id]);
  if (d.para.length === 0) {
    await patch('evaluaciones', `id=eq.${e.id}`, { seguimiento_sin_destino_el: new Date().toISOString() });
    return { estado: 'sin destino' };
  }

  const token = e.seguimiento_token ?? `sg_${randomBytes(24).toString('base64url')}`;
  if (!e.seguimiento_token) await patch('evaluaciones', `id=eq.${e.id}`, { seguimiento_token: token });

  const c = armarCorreoSeguimiento({
    nombre: d.nombre,
    persona: (e.personas?.nombre ?? 'la persona').trim(),
    pila: partesDePersona(e.personas ?? { nombre: '' }).pila,
    puesto: pedido.puesto.trim(),
    enlace: `${SITIO}/seguimiento/${token}`,
    recordatorio,
  });

  const envio = await enviarCorreo({
    de: 'pedidos',
    para: d.para,
    copia: d.copia,
    ...c,
    responderA: [e.evaluadoras?.email ?? ''],
    // Con el enlace: es uno por evaluación, y un reintento con el mismo no sale dos veces.
    clave: `seguimiento-${recordatorio ? 'recordatorio-' : ''}${e.id}-${token}`,
  });
  if (!envio.ok) return { estado: 'falló', motivo: envio.detalle ?? envio.motivo };

  await patch(
    'evaluaciones',
    `id=eq.${e.id}`,
    recordatorio
      ? { seguimiento_recordado_el: new Date().toISOString() }
      : {
          seguimiento_enviado_el: new Date().toISOString(),
          seguimiento_sin_destino_el: null,
          seguimiento_respondio: [...d.para, ...d.copia].join(', '),
        }
  );
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  return { estado: 'enviado', a: d.para };
}

/**
 * El correo, armado: asunto, texto y HTML. Lo usan el envío y la vista previa
 * (`app/api/os/correo-seguimiento-vista/route.ts`), así lo que se mira es lo
 * que sale.
 */
export function armarCorreoSeguimiento(a: {
  /** El nombre de pila de a quién va, si va a uno solo. */
  nombre: string | null;
  persona: string;
  pila: string;
  puesto: string;
  enlace: string;
  recordatorio: boolean;
}): { asunto: string; texto: string; html: string } {
  const pila = a.pila || a.persona;
  const saludo = a.nombre ? `Hola ${a.nombre}:` : 'Hola:';
  const frase = a.recordatorio
    ? `La semana pasada te escribimos para saber cómo le va a ${a.persona} como ${a.puesto}, a noventa días de su ingreso.`
    : `Hace noventa días ${a.persona} empezó a trabajar con ustedes como ${a.puesto}. Queremos saber cómo le va.`;
  const reenviar =
    'Si preferís que lo responda su jefe directo, reenviale este correo: el enlace funciona para quien lo reciba.';
  const porQue = 'Lo que nos cuentes es lo que nos permite medir qué tan bien anticipó la evaluación cómo iba a trabajar.';
  // Cada botón abre la página con esa respuesta marcada. No la guarda: los
  // servicios de correo abren los enlaces para revisarlos, y guardar en la
  // apertura dejaría respuestas que nadie dio. Guarda el "Enviar" de la página.
  const botones = EN_EL_CORREO.opciones
    .map(
      (o, i) =>
        `<a href="${a.enlace}?d=${i}" style="display:block;border:1px solid #16202b;color:#16202b;text-decoration:none;font-size:14px;padding:11px 16px;margin:0 0 8px;">${escapar(o)}</a>`
    )
    .join('\n      ');
  return {
    asunto: `${a.recordatorio ? 'Recordatorio: ' : ''}¿Cómo le va a ${a.persona}? · ${a.puesto}`,
    texto: [saludo, '', frase, '', reenviar, '', `Responder: ${a.enlace}`, '', porQue, '', 'Campos HR · www.camposhr.com'].join('\n'),
    // Cómo reenviarlo va pegado a la presentación, antes de la pregunta: es
    // lo que decide quien lo recibe antes de contestar. Al final, para qué
    // sirve, que cierra el correo.
    html: hoja(
      `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
        `    <p style="${PARRAFO}">${escapar(frase)}</p>\n` +
        `    <p style="${PARRAFO}">${escapar(reenviar)}</p>\n` +
        `    <p style="${PARRAFO}margin-top:22px;font-weight:bold;">${escapar(EN_EL_CORREO.pregunta(pila))}</p>\n` +
        `    <div>\n      ${botones}\n    </div>\n` +
        `    <p style="${PARRAFO}margin:22px 0 0;">${escapar(porQue)}</p>`
    ),
  };
}

/** El enlace de ejemplo de la vista previa: abre la página real y no toca la base. */
export const VISTA_PREVIA_SEGUIMIENTO = 'sg_vista_previa_del_correo';

export type Pendiente = {
  id: string;
  /** El nombre de pila, que es como se pregunta en la página. */
  pila: string;
  persona: string;
  puesto: string;
  respondido: boolean;
};

/** La evaluación de un enlace, para dibujar la página. Null si el enlace no existe. */
export async function porToken(token: string): Promise<Pendiente | null> {
  if (!TOKEN_SEGUIMIENTO.test(token)) return null;
  if (token === VISTA_PREVIA_SEGUIMIENTO) {
    return { id: '', pila: 'Lucía', persona: 'Lucía Barrientos', puesto: 'Cajera de sucursal', respondido: false };
  }
  const [f] = await select<{
    id: string;
    seguimiento_respondido_el: string | null;
    personas: { nombre: string; nombre_pila: string | null; apellido: string | null } | null;
    pedidos: { puesto: string } | null;
  }>(
    'evaluaciones',
    'select=id,seguimiento_respondido_el,personas(nombre,nombre_pila,apellido),pedidos(puesto)' +
      `&seguimiento_token=eq.${token}&limit=1`
  );
  if (!f) return null;
  return {
    id: f.id,
    pila: partesDePersona(f.personas ?? { nombre: '' }).pila || (f.personas?.nombre ?? '').trim(),
    persona: (f.personas?.nombre ?? '').trim(),
    puesto: (f.pedidos?.puesto ?? '').trim(),
    respondido: Boolean(f.seguimiento_respondido_el),
  };
}

/**
 * Guarda lo que contestaron. Las tres preguntas cerradas son obligatorias y
 * tienen que ser una de sus opciones; el comentario es opcional.
 */
export async function responder(
  token: string,
  respuestas: Record<string, string>
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const e = await porToken(token);
  if (!e) return { ok: false, motivo: 'El enlace no existe.' };
  if (e.respondido) return { ok: true };
  const deEjemplo = token === VISTA_PREVIA_SEGUIMIENTO;

  const fila: Record<string, unknown> = {};
  for (const p of PREGUNTAS_SEGUIMIENTO) {
    const v = (respuestas[p.campo] ?? '').trim();
    if (!p.opciones.includes(v)) return { ok: false, motivo: 'Faltan respuestas.' };
    fila[p.campo] = v;
  }
  const comentario = (respuestas.comentario ?? '').trim().slice(0, LARGO_COMENTARIO);
  fila.seguimiento_resultado = resultadoDelSeguimiento(
    fila.seguimiento_sigue as string,
    fila.seguimiento_desempeno as string
  );
  if (comentario) fila.seguimiento_notas = comentario;
  fila.seguimiento_respondido_el = new Date().toISOString();

  // La de la vista previa valida igual y no guarda nada.
  if (deEjemplo) return { ok: true };
  await patch('evaluaciones', `id=eq.${e.id}`, fila);
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  return { ok: true };
}
