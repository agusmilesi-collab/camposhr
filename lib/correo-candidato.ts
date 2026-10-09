/**
 * El correo al candidato con el día, la hora y el lugar de su entrevista.
 *
 * Sale solo cuando la entrevista queda agendada, y dice dónde según la
 * modalidad:
 *
 * - **Presencial**: la dirección del consultorio (`lib/consultorio.ts`), con un
 *   botón que la abre en Google Maps: la persona va por primera vez.
 * - **Online**: el enlace de la sala de Meet. La sala la crea el evento del
 *   calendario de la evaluadora (`lib/google-calendario.ts`), así que sin su
 *   Google conectado no hay enlace y el correo no sale: una confirmación de
 *   videollamada sin por dónde entrar no le sirve a nadie.
 *
 * **Sale una vez por fecha y modalidad**, igual que el aviso al cliente:
 * `evaluaciones.aviso_candidato_fecha` guarda para qué fecha se avisó y
 * `aviso_candidato_modalidad` con qué modalidad. Si la entrevista se reprograma
 * sale de nuevo y lo dice; la sala es la misma. Si el día queda igual y cambia
 * la modalidad también sale: quien tenía el enlace necesita la dirección, y al
 * revés. Un aviso anotado sin modalidad (los de antes de que existiera la
 * columna) vale para la que tenga.
 *
 * **El de la online pide confirmar la asistencia.** Google Meet no manda su
 * invitación porque el correo lo mandamos nosotros, así que el botón
 * "Confirmar asistencia" va arriba del de entrar y abre
 * `camposhr.com/confirmar/<token>` (`app/confirmar/[token]/route.ts`). La
 * confirmación queda en `evaluaciones.asistencia_confirmada_el` y se ve en la
 * tarjeta de Agendadas y en la ficha. Vale para una fecha: si la entrevista se
 * reprograma se borra, porque lo que confirmó fue el otro día.
 *
 * La respuesta del candidato cae en la evaluadora, que es con quien coordinó.
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { patch, select } from '@/lib/supabase';
import { enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { BOTON, PARRAFO, hoja } from '@/lib/correo-destinos';
import { CONSULTORIO, CONSULTORIO_MAPA } from '@/lib/consultorio';
import { partesDelNombre, partesDePersona } from '@/lib/personas';

const ZONA = 'America/Argentina/Cordoba';

/**
 * Dónde vive la página de confirmar: el host principal, el de los enlaces al
 * candidato. `SITIO_CANDIDATO` lo cambia en local, donde el correo de prueba
 * tiene que abrir la página de esta máquina y no la publicada.
 */
const SITIO = (process.env.SITIO_CANDIDATO || 'https://camposhr.com').replace(/\/$/, '');

type Fila = {
  id: string;
  estado: string;
  modalidad: string | null;
  fecha_entrevista: string | null;
  baja_el: string | null;
  enlace_meet: string | null;
  aviso_candidato_fecha: string | null;
  aviso_candidato_modalidad: string | null;
  confirmar_token: string | null;
  personas: {
    nombre: string;
    nombre_pila: string | null;
    apellido: string | null;
    email: string | null;
  } | null;
  evaluadoras: { nombre: string; email: string | null; telefono: string | null } | null;
  pedidos: { puesto: string; baterias: { duracion_min: number | null } | null } | null;
};

/** "martes 14 de octubre a las 10:30 hs", en la hora de acá. */
function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} a las ${hora} hs`;
}

/**
 * El botón de confirmar: pastilla verde clara con borde y letra oscuros, y su
 * tilde. Con el azul oscuro de los demás quedaban dos bloques iguales en el
 * correo y no se distinguía cuál era el de contestar.
 */
const BOTON_CONFIRMAR =
  'display:inline-block;background:#d9f2d0;color:#16202b;border:1px solid #16202b;border-radius:999px;' +
  'text-decoration:none;font-size:14px;padding:11px 19px;';

/**
 * El ícono de WhatsApp del correo (`public/correo/whatsapp.png`). Va siempre
 * contra el sitio publicado y no contra `SITIO`: un correo no puede cargar una
 * imagen de localhost, y Gmail no dibuja SVG ni imágenes incrustadas.
 */
export const ICONO_WHATSAPP = 'https://camposhr.com/correo/whatsapp.png';

/** El gris de lo que acompaña: la hora de Argentina y la línea de las dudas, al pie. */
const GRIS = '#7a756b';

/** El botón secundario: mismo tamaño que los otros, sin relleno. */
const BOTON_CALENDARIO =
  'display:inline-block;background:#ffffff;color:#16202b;border:1px solid #16202b;' +
  'text-decoration:none;font-size:14px;padding:11px 19px;';

/** "20261030T160000Z", como pide Google Calendar. */
const paraGoogle = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * El enlace que abre Google Calendar con la entrevista ya cargada.
 *
 * Confirmar no le deja nada en su calendario: el evento vive en el de la
 * evaluadora y la persona no es invitada, porque la invitación de Google
 * sería un segundo correo sobre lo mismo. Con este enlace la guarda ella, con
 * un toque. Dura lo que la batería del pedido y dos horas si no lo dice, igual
 * que el evento de la evaluadora.
 */
function enlaceCalendario(inicio: string, minutos: number, donde: string, detalle: string): string {
  const desde = new Date(inicio);
  const hasta = new Date(desde.getTime() + minutos * 60_000);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Entrevista con Campos HR',
    dates: `${paraGoogle(desde)}/${paraGoogle(hasta)}`,
    details: detalle,
    location: donde,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const mismoMomento = (a: string | null, b: string | null) =>
  Boolean(a && b) && new Date(a as string).getTime() === new Date(b as string).getTime();

/**
 * Los datos de ejemplo de la vista previa del correo
 * (`/api/os/correo-candidato-vista`). El token abre la página de confirmar
 * con estos mismos datos y sin tocar la base, para poder recorrer el circuito
 * entero desde la vista: no es de ninguna evaluación.
 */
export const VISTA_PREVIA = {
  token: 'cf_vista_previa_del_correo',
  nombre: 'Lucía Barrientos',
  /** Siempre una semana para adelante, a las 11:00 de Argentina. */
  fecha(): string {
    const d = new Date(Date.now() + 7 * 86_400_000);
    d.setUTCHours(14, 0, 0, 0);
    return d.toISOString();
  },
};

type ParaCalendario = {
  fecha: string;
  minutos: number;
  online: string | null;
  con: string | null;
};

/** Dónde es y qué dice la entrevista en un calendario, online o presencial. */
function lugarYDetalle(d: ParaCalendario): { donde: string; detalle: string } {
  const con = d.con?.trim();
  return {
    donde: d.online ?? `${CONSULTORIO}, Santa Fe, Argentina`,
    detalle: d.online
      ? `Videollamada de Google Meet${con ? ` con ${con}` : ''}: ${d.online}`
      : `Entrevista presencial${con ? ` con ${con}` : ''} en ${CONSULTORIO}. Cómo llegar: ${CONSULTORIO_MAPA}`,
  };
}

/** El enlace de "Agregar a mi Google Calendar" de una entrevista. */
export function calendarioDeLaEntrevista(d: ParaCalendario): string {
  const { donde, detalle } = lugarYDetalle(d);
  return enlaceCalendario(d.fecha, d.minutos, donde, detalle);
}

/**
 * La misma entrevista como archivo .ics, para quien no usa Google Calendar:
 * lo abren el calendario del iPhone y de la Mac, Outlook y casi cualquier
 * otro. `uid` identifica el evento: con el mismo, volver a abrir el archivo
 * actualiza la entrevista en vez de duplicarla.
 */
export function icsDeLaEntrevista(d: ParaCalendario, uid: string): string {
  const { donde, detalle } = lugarYDetalle(d);
  const desde = new Date(d.fecha);
  const hasta = new Date(desde.getTime() + d.minutos * 60_000);
  const texto = (x: string) =>
    x.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campos HR//Entrevista//ES',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@camposhr.com`,
    `DTSTAMP:${paraGoogle(new Date())}`,
    `DTSTART:${paraGoogle(desde)}`,
    `DTEND:${paraGoogle(hasta)}`,
    `SUMMARY:${texto('Entrevista con Campos HR')}`,
    `LOCATION:${texto(donde)}`,
    `DESCRIPTION:${texto(detalle)}`,
    ...(d.online ? [`URL:${d.online}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export type DatosCorreoCandidato = {
  nombre: string;
  /** Con qué nombre se lo saluda. Sin esto se deduce del nombre completo. */
  pila?: string;
  puesto: string | null;
  /** El nombre de la evaluadora. */
  con: string | null;
  /** Su WhatsApp, si está cargado (`evaluadoras.telefono`). */
  whatsapp: string | null;
  fecha: string;
  /** Cuánto dura, para el enlace del calendario. */
  minutos: number;
  /** El enlace de Meet si es online; null si es presencial. */
  online: string | null;
  /** El enlace de confirmar asistencia, solo en las online. */
  confirmar: string | null;
  /**
   * Tres correos distintos: el primero, el de otra fecha y el de la misma
   * fecha con otra modalidad. Si cambian las dos cosas manda la fecha, que es
   * lo que la persona tiene que volver a anotar; el lugar va siempre abajo.
   */
  tipo: 'nuevo' | 'reprogramado' | 'modalidad';
};

/**
 * Arma el correo, sin mandarlo ni tocar la base.
 *
 * Está aparte del envío para poder mirarlo: `/api/os/correo-candidato-vista`
 * lo dibuja con datos de ejemplo, y así se ajusta la redacción y los botones
 * sin disparar un correo por cada cambio.
 */
export function armarCorreoCandidato(d: DatosCorreoCandidato): {
  asunto: string;
  texto: string;
  html: string;
} {
  const { online, confirmar } = d;
  const pasoA = online ? 'pasó a ser por videollamada' : 'pasó a ser presencial';
  const pila = d.pila ?? partesDelNombre(d.nombre).pila;
  const puesto = d.puesto?.trim();
  const con = d.con?.trim();
  const saludo = pila ? `Hola ${pila}:` : 'Hola:';
  const frase =
    d.tipo === 'modalidad'
      ? `Tu entrevista con Campos HR${puesto ? ` para el puesto ${puesto}` : ''} ${pasoA}. ` +
        `Se mantiene el ${cuando(d.fecha)}, hora de Argentina.`
      : `Tu entrevista con Campos HR${puesto ? ` para el puesto ${puesto}` : ''} ` +
        `${d.tipo === 'reprogramado' ? 'se reprogramó' : 'quedó agendada'} para el ${cuando(d.fecha)}, hora de Argentina.`;
  // En el correo dibujado, el día y la hora van en su propio renglón, en
  // negrita y más grandes: es lo que la persona busca al abrirlo y lo que
  // vuelve a mirar el día de la entrevista. La frase de arriba termina en dos
  // puntos y lo presenta. El texto plano conserva la oración entera.
  const entrada =
    d.tipo === 'modalidad'
      ? `Tu entrevista con Campos HR${puesto ? ` para el puesto ${puesto}` : ''} ${pasoA}. Se mantiene el día y la hora:`
      : `Tu entrevista con Campos HR${puesto ? ` para el puesto ${puesto}` : ''} ` +
        `${d.tipo === 'reprogramado' ? 'se reprogramó' : 'quedó agendada'} para:`;
  const dia = cuando(d.fecha);
  const fraseHtml =
    `${escapar(entrada)}</p>\n` +
    `    <p style="font-size:21px;line-height:1.3;font-weight:bold;margin:0 0 18px;">` +
    `${escapar(dia.charAt(0).toUpperCase() + dia.slice(1))} · ${online ? 'Online' : 'Presencial'}` +
    `<br><span style="font-size:13px;font-weight:normal;color:${GRIS};">Hora de Argentina</span>`;
  // La modalidad ya la dice el renglón del día: acá va con quién y dónde. El
  // WhatsApp de la evaluadora, si lo tiene cargado, va en la última línea.
  const whatsapp = (con && d.whatsapp?.trim()) || null;
  const numero = whatsapp ? whatsapp.replace(/\D/g, '') : '';
  const quien = con ? `Te entrevista ${con}` : 'La entrevista es';
  const donde = online ? 'por Google Meet.' : `en ${CONSULTORIO}.`;
  const entrar = 'Se entra con este enlace desde una computadora con cámara y micrófono:';
  const como =
    `${quien} ${donde}` + (online ? ` ${entrar}` : '');
  // El número dibujado: el ícono y el enlace que abre el chat.
  const numeroHtml = whatsapp
    ? `<a href="https://wa.me/${numero}" style="color:${GRIS};white-space:nowrap;">` +
      `<img src="${ICONO_WHATSAPP}" width="15" height="15" alt="WhatsApp" style="vertical-align:-2px;border:0;"> ` +
      `${escapar(whatsapp)}</a>`
    : '';
  // Va al pie, que es donde la persona busca a quién escribirle.
  const pila2 = con ? con.split(/\s+/)[0] : '';
  const cambio = whatsapp
    ? `Por cualquier duda, escribile por WhatsApp a ${pila2} al ${whatsapp}, o respondé este correo.`
    : 'Por cualquier duda, respondé este correo.';
  const cambioHtml = whatsapp
    ? `Por cualquier duda, escribile por WhatsApp a ${escapar(pila2)} al ${numeroHtml}, o respondé este correo.`
    : escapar(cambio);
  const pedido = 'Confirmá que vas a estar:';

  const calendario = calendarioDeLaEntrevista(d);
  // En la presencial el del calendario va al lado del mapa. En la online no
  // va en el correo: está en la página que se abre al confirmar, que es
  // cuando la persona ya dijo que va y le sirve anotarla.
  const botonCalendario = `<a href="${escapar(calendario)}" style="${BOTON_CALENDARIO}margin-left:8px;">Agregar a mi Google Calendar</a>`;

  return {
    asunto: `Tu entrevista con Campos HR${d.tipo === 'modalidad' ? ` ${pasoA}` : d.tipo === 'reprogramado' ? ' se reprogramó' : ''}: ${cuando(d.fecha)}`,
    texto: [
      saludo,
      '',
      frase,
      '',
      ...(confirmar ? [`${pedido} ${confirmar}`, ''] : []),
      como,
      ...(online ? [online] : [`Cómo llegar: ${CONSULTORIO_MAPA}`]),
      ...(online ? [] : [`Agregar a tu Google Calendar: ${calendario}`]),
      '',
      cambio,
      '',
      'Campos HR · www.camposhr.com',
    ].join('\n'),
    html: hoja(
      `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
        `    <p style="${PARRAFO}">${fraseHtml}</p>\n` +
        (confirmar
          ? `    <p style="${PARRAFO}">${escapar(pedido)}</p>\n` +
            `    <p style="${PARRAFO}margin-bottom:26px;"><a href="${escapar(confirmar)}" style="${BOTON_CONFIRMAR}">&#10003;&nbsp; Confirmar asistencia</a></p>\n` +
            // Una línea separa lo que hay que hacer ahora (confirmar) de lo
            // que se usa el día de la entrevista (por dónde se entra).
            `    <div style="border-top:1px solid #e3ded4;margin:0 0 26px;font-size:0;line-height:0;">&nbsp;</div>\n`
          : '') +
        `    <p style="${PARRAFO}">${escapar(como)}</p>\n` +
        (online
          ? `    <p style="${PARRAFO}margin-bottom:36px;"><a href="${escapar(online)}" style="${BOTON}">Entrar a la videollamada</a></p>\n`
          : `    <p style="${PARRAFO}margin-bottom:36px;"><a href="${escapar(CONSULTORIO_MAPA)}" style="${BOTON}">Ver en Google Maps</a>${botonCalendario}</p>\n`) +
        `    <p style="${PARRAFO}margin:0;color:${GRIS};">${cambioHtml}</p>`
    ),
  };
}

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
        'aviso_candidato_modalidad,confirmar_token,' +
        'personas(nombre,nombre_pila,apellido,email),evaluadoras(nombre,email,telefono),pedidos(puesto,baterias(duracion_min))' +
        `&id=eq.${evaluacionId}&limit=1`
    );
    if (
      !e ||
      e.baja_el ||
      e.estado !== 'Por entrevistar' ||
      (e.modalidad !== 'Presencial' && !(e.modalidad === 'Online' && e.enlace_meet)) ||
      !e.fecha_entrevista ||
      !e.personas?.email ||
      new Date(e.fecha_entrevista).getTime() <= Date.now()
    ) {
      return;
    }
    const mismaFecha = mismoMomento(e.fecha_entrevista, e.aviso_candidato_fecha);
    const mismaModalidad =
      !e.aviso_candidato_modalidad || e.aviso_candidato_modalidad === e.modalidad;
    if (mismaFecha && mismaModalidad) return;

    const otraVez = Boolean(e.aviso_candidato_fecha);
    const soloModalidad = mismaFecha && !mismaModalidad;
    const online = e.modalidad === 'Online' && e.enlace_meet ? e.enlace_meet : null;

    // El enlace de confirmar es de la evaluación y se crea la primera vez que
    // hace falta. Si no se pudo guardar, el correo sale igual y sin el botón:
    // un enlace que no existe en la base llevaría a "ya no sirve".
    let confirmar: string | null = null;
    if (online) {
      let token = e.confirmar_token;
      if (!token) {
        token = `cf_${randomBytes(18).toString('base64url')}`;
        await patch('evaluaciones', `id=eq.${e.id}`, { confirmar_token: token });
      }
      confirmar = `${SITIO}/confirmar/${token}`;
    }

    const envio = await enviarCorreo({
      de: 'entrevistas',
      para: [e.personas.email],
      ...armarCorreoCandidato({
        nombre: e.personas.nombre,
        pila: partesDePersona(e.personas).pila,
        puesto: e.pedidos?.puesto ?? null,
        con: e.evaluadoras?.nombre ?? null,
        whatsapp: e.evaluadoras?.telefono ?? null,
        fecha: e.fecha_entrevista,
        minutos: e.pedidos?.baterias?.duracion_min || 120,
        online,
        confirmar,
        tipo: soloModalidad ? 'modalidad' : otraVez ? 'reprogramado' : 'nuevo',
      }),
      responderA: [e.evaluadoras?.email ?? ''],
      // La modalidad entra en la clave: si pasa de online a presencial el
      // mismo día, el segundo correo no es un duplicado del primero.
      clave: `candidato-${e.id}-${new Date(e.fecha_entrevista).getTime()}-${online ? 'online' : 'presencial'}`,
    });
    if (envio.ok) {
      await patch('evaluaciones', `id=eq.${e.id}`, {
        aviso_candidato_fecha: e.fecha_entrevista,
        aviso_candidato_modalidad: e.modalidad,
        // Otra fecha es otra entrevista que confirmar.
        ...(mismaFecha ? {} : { asistencia_confirmada_el: null }),
      });
    }
  } catch (err) {
    console.error('[correo] no se pudo avisar al candidato', err);
  }
}
