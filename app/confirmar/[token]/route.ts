/**
 * La confirmación de asistencia a una entrevista online, en
 * camposhr.com/confirmar/<token>.
 *
 * El candidato llega desde el botón "Confirmar asistencia" del correo que le
 * manda el sistema (`lib/correo-candidato.ts`). Google Meet no le pide
 * confirmación porque la invitación no sale de Google: sale de acá.
 *
 * **Para la persona es un solo toque: el del correo.** La página que se abre
 * ya dice "Listo, asistencia confirmada" con su tilde verde, y manda la
 * confirmación por detrás al cargar; no hay un paso intermedio ni un segundo
 * botón. Un correo no puede guardar nada sin abrir una dirección, así que esa
 * página es lo mínimo que existe. No lleva el botón de la videollamada: faltan
 * días para la entrevista y el enlace está en el correo. Lleva el de agregarla
 * a su Google Calendar.
 *
 * **La confirmación viaja en un POST que dispara el navegador, no en la
 * apertura del enlace.** Los servicios de correo abren los enlaces por su
 * cuenta para revisarlos, sin ejecutar la página: con la confirmación en la
 * apertura todas quedarían confirmadas sin que la persona haya tocado nada.
 * Si el envío falla o el navegador no lo ejecuta, la página pasa a mostrar el
 * botón "Confirmar asistencia" en lugar del tilde.
 *
 * Se sirve como documento entero, igual que `/privacidad`: lleva la
 * tipografía de la home sin cargar los estilos del OS.
 */

import { revalidateTag } from 'next/cache';
import { patch, select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { escapar } from '@/lib/correo';
import { partesDePersona } from '@/lib/personas';
import { VISTA_PREVIA, calendarioDeLaEntrevista, icsDeLaEntrevista } from '@/lib/correo-candidato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN = /^cf_[A-Za-z0-9_-]{16,64}$/;
const ZONA = 'America/Argentina/Cordoba';

type Fila = {
  id: string;
  estado: string;
  baja_el: string | null;
  fecha_entrevista: string | null;
  enlace_meet: string | null;
  asistencia_confirmada_el: string | null;
  personas: { nombre: string; nombre_pila?: string | null; apellido?: string | null } | null;
  evaluadoras: { nombre: string } | null;
  pedidos: { baterias: { duracion_min: number | null } | null } | null;
};

async function buscar(token: string): Promise<Fila | null> {
  if (!TOKEN.test(token)) return null;
  // El de la vista previa del correo: se dibuja igual y no existe en la base.
  if (token === VISTA_PREVIA.token) {
    return {
      id: '',
      estado: 'Por entrevistar',
      baja_el: null,
      fecha_entrevista: VISTA_PREVIA.fecha(),
      enlace_meet: 'https://meet.google.com/abc-defg-hij',
      asistencia_confirmada_el: null,
      personas: { nombre: VISTA_PREVIA.nombre },
      evaluadoras: { nombre: 'Lorena Campos' },
      pedidos: null,
    };
  }
  const filas = await select<Fila>(
    'evaluaciones',
    'select=id,estado,baja_el,fecha_entrevista,enlace_meet,asistencia_confirmada_el,personas(nombre,nombre_pila,apellido),evaluadoras(nombre),pedidos(baterias(duracion_min))' +
      `&confirmar_token=eq.${token}&limit=1`
  );
  return filas[0] ?? null;
}

function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} a las ${hora}`;
}

/** El tilde verde de las dos páginas que dicen "confirmada": se lee antes que el título. */
const TILDE =
  '<svg class="tilde" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#2e7d4f"/>' +
  '<path d="M14 24.5l7 7 13-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function pagina(
  titulo: string,
  texto: string,
  accion = '',
  status = 200,
  conTilde = false
): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>${escapar(titulo)}. Campos HR</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f6f5f2; color: #16202b; line-height: 1.42; padding: 0 24px; }
    .hoja { max-width: 600px; margin: 0 auto; padding: 64px 0 72px; }
    .marca { font-family: 'Instrument Serif', Georgia, serif; font-size: 1.35rem; letter-spacing: -0.022em; padding-bottom: 44px; }
    .tilde { display: block; width: 48px; height: 48px; margin-bottom: 22px; }
    h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(1.7rem, 7.4vw, 2.6rem); font-weight: 400; line-height: 1.06; letter-spacing: -0.03em; }
    p { margin-top: 18px; font-size: 0.95rem; line-height: 1.5; color: #3c4650; }
    form { margin-top: 28px; }
    button, .boton { display: inline-block; border: 0; background: #16202b; color: #fff; font: inherit; font-size: 0.95rem; padding: 13px 22px; cursor: pointer; text-decoration: none; }
    .agendar { margin-top: 28px; display: flex; flex-wrap: wrap; gap: 10px; }
    .boton.claro { display: inline-flex; align-items: center; gap: 9px; background: #fff; color: #16202b; border: 1px solid #16202b; padding: 11px 18px; }
    .boton.claro svg { width: 20px; height: 20px; flex: none; }
    @media (max-width: 34rem) { body { padding: 0 20px; } .hoja { padding: 40px 0 52px; } .marca { padding-bottom: 32px; } }
  </style>
</head>
<body>
  <div class="hoja">
    <div class="marca">Campos HR</div>
    ${conTilde ? TILDE : ''}
    <h1>${escapar(titulo)}</h1>
    <p>${escapar(texto)}</p>
    ${accion}
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const noEsta = () =>
  pagina(
    'Este enlace ya no sirve',
    'La entrevista no está agendada o cambió de fecha. Si te llegó un correo más nuevo, usá el botón de ese.',
    '',
    404
  );

/** "Listo, Lucía. Tu asistencia está confirmada": con el nombre, que es a quien se le contesta. */
function listo(e: Fila): string {
  const pila = partesDePersona(e.personas ?? { nombre: '' }).pila;
  return pila ? `Listo, ${pila}. Tu asistencia está confirmada` : 'Listo. Tu asistencia está confirmada';
}

const ICONO_CALENDARIO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#16202b" stroke-width="1.7" stroke-linecap="round">' +
  '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>';

const datosCalendario = (e: Fila) => ({
  fecha: e.fecha_entrevista as string,
  minutos: e.pedidos?.baterias?.duracion_min || 120,
  online: e.enlace_meet,
  con: e.evaluadoras?.nombre ?? null,
});

/**
 * Agendarla en su calendario, debajo del tilde: la persona acaba de decir que
 * va y es el momento de anotarla. Confirmar no le agenda nada por sí solo.
 *
 * Es un solo botón y el servidor decide a dónde lleva (`?agendar=1`): no se le
 * pregunta a la persona qué calendario usa. Ver `GET`.
 */
const agendar = (token: string) =>
  `<div class="agendar">` +
  `<a class="boton claro" href="/confirmar/${token}?agendar=1">${ICONO_CALENDARIO}Agregar a mi calendario</a>` +
  `</div>`;

const vigente = (e: Fila | null): e is Fila =>
  Boolean(e && !e.baja_el && e.estado === 'Por entrevistar' && e.fecha_entrevista);

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const e = await buscar(params.token);
  if (!vigente(e)) return noEsta();
  // El botón "Agregar a mi calendario". En un iPhone o un iPad baja la
  // entrevista como archivo .ics, que el teléfono abre en su calendario; en
  // todo lo demás abre Google Calendar con la entrevista cargada, que es lo
  // que tiene quien usa Android o entra desde una computadora con su cuenta
  // de Google. `?ics=1` fuerza el archivo, por si hace falta pasárselo a
  // alguien que usa Outlook.
  const q = new URL(req.url).searchParams;
  const esApple = /iPhone|iPad|iPod/i.test(req.headers.get('user-agent') ?? '');
  if (q.has('ics') || (q.has('agendar') && esApple)) {
    return new Response(icsDeLaEntrevista(datosCalendario(e), `entrevista-${e.id || 'ejemplo'}`), {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'attachment; filename="entrevista-campos-hr.ics"',
        'cache-control': 'no-store',
      },
    });
  }
  if (q.has('agendar')) {
    return Response.redirect(calendarioDeLaEntrevista(datosCalendario(e)), 302);
  }
  const dia = cuando(e.fecha_entrevista as string);
  if (e.asistencia_confirmada_el) {
    return pagina(
      listo(e),
      `Te esperamos el ${dia}, hora de Argentina, por videollamada de Google Meet.`,
      agendar(params.token),
      200,
      true
    );
  }
  // Se dibuja ya confirmada y el guardado va por detrás: con una pantalla
  // intermedia que se enviaba sola, la persona veía un botón un instante antes
  // del tilde. Si el guardado no sale, el tilde se cambia por el botón.
  return pagina(
    listo(e),
    `Te esperamos el ${dia}, hora de Argentina. El enlace de la videollamada está en el correo que recibiste.`,
    `<div id="agendar">${agendar(params.token)}</div>` +
    '<form method="post" hidden><button type="submit">Confirmar asistencia</button></form>' +
      '<noscript><form method="post"><button type="submit">Confirmar asistencia</button></form></noscript>' +
      `<script>
        fetch(location.href, { method: 'POST' })
          .then(function (r) { if (!r.ok) throw 0; })
          .catch(function () {
            document.querySelector('.tilde').remove();
            document.getElementById('agendar').remove();
            document.querySelector('h1').textContent = 'Confirmá tu entrevista';
            document.forms[0].hidden = false;
          });
      </script>`,
    200,
    true
  );
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const e = await buscar(params.token);
  if (!vigente(e)) return noEsta();
  if (!e.asistencia_confirmada_el && e.id) {
    await patch('evaluaciones', `id=eq.${e.id}`, {
      asistencia_confirmada_el: new Date().toISOString(),
    });
    revalidateTag(CACHE_PSICOTECNICOS);
  }
  return pagina(
    listo(e),
    `Te esperamos el ${cuando(e.fecha_entrevista as string)}, hora de Argentina. El enlace de la videollamada está en el correo que recibiste.`,
    agendar(params.token),
    200,
    true
  );
}
