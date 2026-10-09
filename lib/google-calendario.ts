/**
 * La entrevista agendada, en el Google Calendar de la evaluadora.
 *
 * Cada evaluadora autoriza una vez su cuenta de Google (Configuración,
 * pestaña Calendario). Con ese permiso guardado, el sistema escribe en su
 * calendario sin que ella esté: agendar crea el evento, reprogramar lo mueve,
 * y dar de baja, sacar la fecha o devolver la tarjeta a Por citar lo borra.
 * Si la evaluación pasa a otra evaluadora, el evento se borra del calendario
 * de una y se crea en el de la otra.
 *
 * **Si la entrevista es online, el evento nace con una sala de Meet.** El
 * enlace queda guardado en la evaluación (`enlace_meet`): es el que se ve en
 * la tarjeta de Agendadas y el que se le manda al candidato
 * (`lib/correo-candidato.ts`). Reprogramar conserva la misma sala.
 *
 * Mira cómo quedó la evaluación y no qué se tocó, igual que los avisos por
 * correo: así da lo mismo si se agendó con el botón, arrastrando la tarjeta o
 * desde la ficha. Y no tira nunca: el cambio de la evaluadora ya está guardado
 * cuando esto corre.
 *
 * Sin SDK: OAuth y la API de Calendar se resuelven con `fetch`, igual que
 * Supabase y Resend. Dos variables, `GOOGLE_CLIENT_ID` y
 * `GOOGLE_CLIENT_SECRET`; sin ellas no se hace nada y el resto sigue igual.
 */

import 'server-only';
import { patch, select, upsert } from '@/lib/supabase';
import { CONSULTORIO } from '@/lib/consultorio';

const ZONA = 'America/Argentina/Cordoba';
/**
 * Cuánto ocupa una entrevista en el calendario cuando su batería no tiene la
 * duración cargada. Lo normal es que la tenga: es la que se edita en
 * Configuración, pestaña Baterías (`baterias.duracion_min`).
 */
const DURACION_MIN = 120;

const OS = 'https://os.camposhr.com';
const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOCAR = 'https://oauth2.googleapis.com/revoke';
const EVENTOS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const PERMISO_EVENTOS = 'https://www.googleapis.com/auth/calendar.events';
// Crear contactos: es lo que deja agendar al candidato cuando la evaluadora le
// escribe por WhatsApp (`lib/google-contactos.ts`). El sistema solo crea.
const PERMISO_CONTACTOS = 'https://www.googleapis.com/auth/contacts';
// Los eventos del calendario, los contactos, y el correo de la cuenta para
// mostrar cuál se conectó. Nada más: no se leen otros calendarios.
const ALCANCE = `${PERMISO_EVENTOS} ${PERMISO_CONTACTOS} openid email`;

export const hayGoogle = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** A dónde vuelve Google después de autorizar. Tiene que estar cargada allá. */
export const direccionDeVuelta = (origen: string) => `${origen}/api/os/google/vuelta`;

/** La pantalla de Google donde la evaluadora da el permiso. */
export function urlDeAutorizacion(origen: string, estado: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: direccionDeVuelta(origen),
    response_type: 'code',
    scope: ALCANCE,
    // `offline` y `consent` juntos son lo que hace que Google entregue el
    // permiso duradero también la segunda vez que alguien conecta.
    access_type: 'offline',
    prompt: 'consent',
    state: estado,
  });
  return `${AUTORIZAR}?${q}`;
}

export type Canje =
  | { ok: true; refresh: string; cuenta: string | null; contactos: boolean }
  | { ok: false; motivo: 'fallo' | 'sin-permiso' };

/** Cambia el código que trae la vuelta por el permiso duradero. */
export async function canjear(codigo: string, origen: string): Promise<Canje> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: direccionDeVuelta(origen),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('[google] no se pudo canjear el código', res.status, await res.text());
    return { ok: false, motivo: 'fallo' };
  }
  const t = (await res.json()) as { refresh_token?: string; scope?: string; id_token?: string };
  // Google deja destildar permisos en su pantalla: sin el del calendario, la
  // conexión no sirve para nada y es mejor decirlo que guardarla.
  if (!t.refresh_token || !(t.scope ?? '').split(' ').includes(PERMISO_EVENTOS)) {
    if (t.refresh_token) await revocar(t.refresh_token);
    return { ok: false, motivo: 'sin-permiso' };
  }
  // El de contactos es opcional: si lo destilda, el calendario anda igual y
  // lo único que no pasa es agendar al candidato.
  return {
    ok: true,
    refresh: t.refresh_token,
    cuenta: cuentaDe(t.id_token),
    contactos: (t.scope ?? '').split(' ').includes(PERMISO_CONTACTOS),
  };
}

/** El correo de la cuenta, que viaja adentro del `id_token`. */
function cuentaDe(idToken: string | undefined): string | null {
  try {
    const cuerpo = (idToken ?? '').split('.')[1];
    if (!cuerpo) return null;
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    return typeof datos.email === 'string' ? datos.email : null;
  } catch {
    return null;
  }
}

async function revocar(token: string): Promise<void> {
  await fetch(`${REVOCAR}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
  }).catch(() => null);
}

export async function guardarConexion(
  evaluadoraId: string,
  refresh: string,
  cuenta: string | null,
  contactos = false
): Promise<void> {
  await upsert(
    'google_calendario',
    {
      evaluadora_id: evaluadoraId,
      refresh_token: refresh,
      cuenta,
      contactos,
      conectado_el: new Date().toISOString(),
      caida_el: null,
    },
    'evaluadora_id',
    false
  );
}

/**
 * Corta la conexión: le devuelve el permiso a Google y borra la fila.
 *
 * Los eventos ya creados quedan en el calendario de la evaluadora. Son suyos y
 * sin el permiso ya no se pueden tocar desde acá.
 */
export async function desconectar(evaluadoraId: string): Promise<void> {
  const [fila] = await select<{ refresh_token: string }>(
    'google_calendario',
    `select=refresh_token&evaluadora_id=eq.${evaluadoraId}&limit=1`
  );
  if (!fila) return;
  await revocar(fila.refresh_token);
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY ?? '';
  await fetch(`${url}/rest/v1/google_calendario?evaluadora_id=eq.${evaluadoraId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
}

export type Conexion = {
  evaluadoraId: string;
  cuenta: string | null;
  /** Google rechazó el permiso: hay que volver a conectar. */
  caida: boolean;
  /** Dio también el permiso de contactos. Las conexiones viejas no lo tienen. */
  contactos: boolean;
};

/** Quiénes tienen el calendario conectado. Nunca devuelve el permiso. */
export async function conexiones(): Promise<Conexion[]> {
  const filas = await select<{
    evaluadora_id: string;
    cuenta: string | null;
    caida_el: string | null;
    contactos: boolean | null;
  }>(
    'google_calendario',
    'select=evaluadora_id,cuenta,caida_el,contactos'
  );
  return filas.map((f) => ({
    evaluadoraId: f.evaluadora_id,
    cuenta: f.cuenta,
    caida: Boolean(f.caida_el),
    contactos: f.contactos === true,
  }));
}

/**
 * La llave de una hora para escribir en la cuenta de esa evaluadora (su
 * calendario y, si dio el permiso, sus contactos), o
 * null si no lo conectó o si Google ya no acepta su permiso.
 */
export async function accesoDe(evaluadoraId: string | null): Promise<string | null> {
  if (!evaluadoraId) return null;
  const [fila] = await select<{ refresh_token: string; caida_el: string | null }>(
    'google_calendario',
    `select=refresh_token,caida_el&evaluadora_id=eq.${evaluadoraId}&limit=1`
  );
  if (!fila || fila.caida_el) return null;

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: fila.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const detalle = await res.text();
    console.error('[google] permiso rechazado', res.status, detalle);
    // `invalid_grant` es definitivo: lo revocó ella o venció. Se anota para
    // que la pantalla lo diga y para no volver a intentarlo en cada guardado.
    if (detalle.includes('invalid_grant')) {
      await patch('google_calendario', `evaluadora_id=eq.${evaluadoraId}`, {
        caida_el: new Date().toISOString(),
      });
    }
    return null;
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  return access_token ?? null;
}

type Fila = {
  id: string;
  estado: string;
  modalidad: string | null;
  fecha_entrevista: string | null;
  baja_el: string | null;
  evaluadora_id: string | null;
  calendario_evento_id: string | null;
  calendario_evaluadora_id: string | null;
  calendario_huella: string | null;
  enlace_meet: string | null;
  personas: { nombre: string; telefono: string | null; email: string | null } | null;
  pedidos: {
    puesto: string;
    empresas: { nombre: string } | null;
    baterias: { duracion_min: number | null } | null;
  } | null;
};

const CAMPOS =
  'id,estado,modalidad,fecha_entrevista,baja_el,evaluadora_id,' +
  'calendario_evento_id,calendario_evaluadora_id,calendario_huella,enlace_meet,' +
  'personas(nombre,telefono,email),pedidos(puesto,empresas(nombre),baterias(duracion_min))';

/** Las etapas en las que todavía no hay entrevista, aunque haya quedado una fecha. */
const SIN_ENTREVISTA = new Set(['Sin asignar', 'Por citar']);

const esOnline = (e: Fila) => e.modalidad === 'Online';

/** Lo que dura la batería de ese pedido. */
const minutosDe = (e: Fila) => {
  const m = e.pedidos?.baterias?.duracion_min;
  return typeof m === 'number' && m > 0 ? m : DURACION_MIN;
};

/** Lo que el evento dice. Si esto no cambió, no hay nada que mandarle a Google. */
function huellaDe(e: Fila): string {
  return [
    e.fecha_entrevista ? new Date(e.fecha_entrevista).getTime() : '',
    e.modalidad ?? '',
    e.personas?.nombre ?? '',
    e.personas?.telefono ?? '',
    e.personas?.email ?? '',
    e.pedidos?.puesto ?? '',
    e.pedidos?.empresas?.nombre ?? '',
    minutosDe(e),
    esOnline(e) ? '' : CONSULTORIO,
  ].join('|');
}

function cuerpoDe(e: Fila): Record<string, unknown> {
  const inicio = new Date(e.fecha_entrevista as string);
  const fin = new Date(inicio.getTime() + minutosDe(e) * 60_000);
  const persona = e.personas?.nombre?.trim() || 'Candidato';
  const puesto = e.pedidos?.puesto?.trim() ?? '';
  const empresa = e.pedidos?.empresas?.nombre?.trim() ?? '';
  const renglones = [
    [puesto, empresa].filter(Boolean).join(' · '),
    e.modalidad ? `Modalidad: ${e.modalidad}` : '',
    e.personas?.telefono ? `Teléfono: ${e.personas.telefono}` : '',
    e.personas?.email ? `Correo: ${e.personas.email}` : '',
    '',
    `Ficha: ${OS}/os/psicotecnicos/ficha/${e.id}?ver=entrevista`,
  ];
  return {
    summary: `Entrevista: ${persona}${puesto ? ` · ${puesto}` : ''}`,
    description: renglones.filter((r, n) => r !== '' || n === renglones.length - 2).join('\n'),
    start: { dateTime: inicio.toISOString(), timeZone: ZONA },
    end: { dateTime: fin.toISOString(), timeZone: ZONA },
    // El lugar va solo en la presencial. En la online se vacía, por si la
    // entrevista cambió de modalidad y el evento lo traía.
    location: e.modalidad === 'Presencial' ? CONSULTORIO : '',
    // Un evento que ella borró a mano queda "cancelado" del lado de Google:
    // si después se reprograma en el OS, vuelve a aparecer.
    status: 'confirmed',
  };
}

type Evento = { id: string; hangoutLink?: string };

async function llamar(
  acceso: string,
  metodo: 'POST' | 'PATCH' | 'DELETE',
  eventoId: string | null,
  cuerpo?: Record<string, unknown>
): Promise<{ status: number; evento: Evento | null }> {
  const res = await fetch(
    // `conferenceDataVersion=1` es lo que deja crear o sacar la sala de Meet.
    `${EVENTOS}${eventoId ? `/${encodeURIComponent(eventoId)}` : ''}?conferenceDataVersion=1`,
    {
      method: metodo,
      headers: { Authorization: `Bearer ${acceso}`, 'content-type': 'application/json' },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    if (res.status !== 404 && res.status !== 410) {
      console.error('[google] Calendar respondió', res.status, await res.text());
    }
    return { status: res.status, evento: null };
  }
  return { status: res.status, evento: metodo === 'DELETE' ? null : await res.json() };
}

const noEsta = (status: number) => status === 404 || status === 410;

/** Pide una sala nueva. La clave hace que un reintento no cree dos. */
const salaNueva = (e: Fila) => ({
  conferenceData: {
    createRequest: {
      requestId: `campos-${e.id}`,
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  },
});

/** Saca el evento del calendario donde está y limpia la evaluación. */
async function quitar(e: Fila): Promise<void> {
  if (!e.calendario_evento_id) return;
  const acceso = await accesoDe(e.calendario_evaluadora_id);
  if (acceso) await llamar(acceso, 'DELETE', e.calendario_evento_id);
  await patch('evaluaciones', `id=eq.${e.id}`, {
    calendario_evento_id: null,
    calendario_evaluadora_id: null,
    calendario_huella: null,
    enlace_meet: null,
  });
  e.calendario_evento_id = null;
  e.calendario_evaluadora_id = null;
  e.calendario_huella = null;
  e.enlace_meet = null;
}

/**
 * Deja el calendario de la evaluadora como dice la evaluación.
 *
 * Se puede llamar las veces que haga falta: si el evento ya dice lo mismo, no
 * hace nada.
 */
export async function sincronizarCalendario(evaluacionId: string): Promise<void> {
  try {
    if (!hayGoogle()) return;
    const [e] = await select<Fila>('evaluaciones', `select=${CAMPOS}&id=eq.${evaluacionId}&limit=1`);
    if (!e) return;

    const corresponde =
      !e.baja_el &&
      Boolean(e.fecha_entrevista) &&
      Boolean(e.evaluadora_id) &&
      !SIN_ENTREVISTA.has(e.estado);

    // Ya no hay entrevista, o la tiene otra: el evento sale de donde estaba.
    if (e.calendario_evento_id && (!corresponde || e.calendario_evaluadora_id !== e.evaluadora_id)) {
      await quitar(e);
    }
    if (!corresponde) return;

    const huella = huellaDe(e);
    if (e.calendario_evento_id && huella === e.calendario_huella) return;

    const acceso = await accesoDe(e.evaluadora_id);
    if (!acceso) return;

    let evento: Evento | null = null;
    if (e.calendario_evento_id) {
      const cuerpo = {
        ...cuerpoDe(e),
        // La sala se pide solo si falta y se saca si la entrevista dejó de
        // ser online. Reprogramar no la toca: el enlace que ya tiene el
        // candidato sigue sirviendo.
        ...(esOnline(e) ? (e.enlace_meet ? {} : salaNueva(e)) : { conferenceData: null }),
      };
      const r = await llamar(acceso, 'PATCH', e.calendario_evento_id, cuerpo);
      evento = r.evento;
      // Si falló por otra cosa que no sea que el evento ya no existe, se deja
      // como está: el próximo cambio lo vuelve a intentar.
      if (!evento && !noEsta(r.status)) return;
    } else if (new Date(e.fecha_entrevista as string).getTime() <= Date.now()) {
      // Una entrevista que ya pasó y nunca estuvo en el calendario no se crea
      // ahora: aparecería cada vez que una evaluación vieja cambia de etapa.
      return;
    }

    if (!evento) {
      const r = await llamar(acceso, 'POST', null, {
        ...cuerpoDe(e),
        ...(esOnline(e) ? salaNueva(e) : {}),
      });
      evento = r.evento;
      if (!evento) return;
    }

    await patch('evaluaciones', `id=eq.${e.id}`, {
      calendario_evento_id: evento.id,
      calendario_evaluadora_id: e.evaluadora_id,
      calendario_huella: huella,
      enlace_meet: esOnline(e) ? evento.hangoutLink ?? e.enlace_meet ?? null : null,
    });
  } catch (err) {
    console.error('[google] no se pudo sincronizar el calendario', err);
  }
}

/**
 * Saca el evento antes de borrar la evaluación. Después ya no se sabría cuál
 * era ni en el calendario de quién estaba.
 */
export async function quitarDelCalendario(evaluacionId: string): Promise<void> {
  try {
    if (!hayGoogle()) return;
    const [e] = await select<Fila>('evaluaciones', `select=${CAMPOS}&id=eq.${evaluacionId}&limit=1`);
    if (e) await quitar(e);
  } catch (err) {
    console.error('[google] no se pudo sacar el evento', err);
  }
}

/**
 * Las entrevistas que esa evaluadora ya tenía agendadas para adelante. Es lo
 * que se sincroniza apenas conecta: si no, vería en el calendario solo las que
 * agende desde ese día.
 */
export async function agendadasDe(evaluadoraId: string): Promise<string[]> {
  const filas = await select<{ id: string }>(
    'evaluaciones',
    `select=id&evaluadora_id=eq.${evaluadoraId}&baja_el=is.null` +
      `&fecha_entrevista=gt.${encodeURIComponent(new Date().toISOString())}`
  );
  return filas.map((f) => f.id);
}
