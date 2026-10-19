/**
 * Las preguntas del seguimiento a los noventa días, en
 * camposhr.com/seguimiento/<token>.
 *
 * Llega quien pidió la búsqueda, desde el botón "Responder" del correo
 * (`lib/seguimiento.ts`). Son tres preguntas de opción múltiple y un comentario
 * opcional, y un botón que manda todo junto.
 *
 * **Abrir el enlace no guarda nada; guarda el envío del formulario.** Los
 * servicios de correo abren los enlaces por su cuenta para revisarlos, y con
 * algo guardado en la apertura quedarían respuestas que nadie dio.
 *
 * Se sirve como documento entero, igual que `/confirmar`: lleva la tipografía
 * de la home sin cargar los estilos del OS, y funciona sin JavaScript.
 */

import { escapar } from '@/lib/correo';
import { porToken, responder } from '@/lib/seguimiento';
import { EN_EL_CORREO, LARGO_COMENTARIO, PREGUNTAS_SEGUIMIENTO } from '@/lib/seguimiento-preguntas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TILDE =
  '<svg class="tilde" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#2e7d4f"/>' +
  '<path d="M14 24.5l7 7 13-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function documento(titulo: string, cuerpo: string, status = 200): Response {
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
    fieldset { border: 0; margin-top: 34px; }
    legend { font-size: 1rem; font-weight: 500; margin-bottom: 12px; }
    /* Todas las opciones miden lo mismo: una debajo de la otra, a todo el
       ancho, cómodas para el pulgar. Con el ancho de su texto, "Sí" quedaba
       chico al lado de "No, la empresa terminó la relación" y se leía como menos. */
    .opciones { display: grid; gap: 10px; max-width: 520px; }
    .opciones label { position: relative; display: flex; }
    .opciones input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
    .opciones span { flex: 1; display: flex; align-items: center; gap: 12px; min-height: 56px; border: 1px solid #c9c5bc; background: #fff; padding: 12px 18px; font-size: 1rem; cursor: pointer; transition: border-color .12s, background .12s, color .12s; }
    .opciones span:hover { border-color: #16202b; }
    .opciones i { flex: none; width: 12px; height: 12px; border-radius: 50%; }
    .opciones input:checked + span { background: #16202b; border-color: #16202b; color: #fff; }
    .opciones input:focus-visible + span { outline: 2px solid #16202b; outline-offset: 2px; }
    /* Fija al pie y finita, como Typeform: dice cuánto falta sin competirle
       a la pregunta, y se ve aunque en el teléfono la pregunta ocupe toda la
       pantalla. */
    .progreso { display: none; position: fixed; left: 0; right: 0; bottom: 0; align-items: center; gap: 12px; padding: 12px 24px calc(12px + env(safe-area-inset-bottom)); background: rgba(246,245,242,.94); backdrop-filter: blur(4px); border-top: 1px solid #e3dfd7; }
    .js .progreso { display: flex; }
    .js body { padding-bottom: 64px; }
    .barra { flex: 1; max-width: 600px; margin: 0 auto; height: 4px; background: #e3dfd7; border-radius: 2px; overflow: hidden; }
    .barra div { height: 100%; width: 0; background: #2e7d4f; border-radius: 2px; transition: width .3s ease-out; }
    .cuenta { flex: none; font-size: 0.78rem; color: #6b7178; }
    .js .paso { margin-top: 26px; }
    .js .paso { display: none; }
    .js .paso.activo { display: block; animation: entra .25s ease-out; }
    @keyframes entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .atras { margin-top: 26px; background: none; color: #3c4650; padding: 6px 0; font-size: 0.9rem; }
    .atras:hover { color: #16202b; text-decoration: underline; }
    textarea { width: 100%; max-width: 520px; min-height: 120px; border: 1px solid #c9c5bc; background: #fff; font: inherit; font-size: 16px; padding: 12px; resize: vertical; } /* 16 px o más: con menos, el iPhone agranda la pantalla al tocar el campo. */
    .nota { font-size: 0.85rem; color: #6b7178; margin-top: 8px; }
    .error { color: #a8402f; font-weight: 500; }
    button { margin-top: 34px; border: 0; background: #16202b; color: #fff; font: inherit; font-size: 0.95rem; padding: 14px 26px; cursor: pointer; }
    @media (max-width: 34rem) { body { padding: 0 20px; } .hoja { padding: 40px 0 52px; } .marca { padding-bottom: 32px; } .opciones { grid-template-columns: minmax(0, 1fr); } }
  </style>
</head>
<body>
  <div class="hoja">
    <div class="marca">Campos HR</div>
    ${cuerpo}
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const noEsta = () =>
  documento(
    'Este enlace no existe',
    '<h1>Este enlace no existe</h1><p>Revisá que el enlace esté completo. Si el problema sigue, respondé el correo y te ayudamos.</p>',
    404
  );

const gracias = () =>
  documento(
    'Gracias',
    `${TILDE}<h1>Gracias, ya tenemos tu respuesta</h1><p>Lo que nos contaste queda en la ficha de la evaluación. Si querés agregar algo, respondé el correo.</p>`
  );

/**
 * El punto de color de la escala del desempeño, de mejor a peor, con los colores
 * del velocímetro (`lib/exigencia.ts`). Refuerza el orden; el texto lo dice igual.
 * Las otras dos preguntas no son escalas y van sin color.
 */
const PUNTOS: Record<string, string[]> = {
  seguimiento_desempeno: ['rgb(58,122,74)', 'rgb(110,163,118)', 'rgb(214,160,20)', 'rgb(196,32,38)'],
};

/**
 * Una pregunta por pantalla, que avanza sola al elegir (como Typeform): se lee
 * como una conversación de tres pasos y no como un formulario. Arriba dice en
 * qué paso va, y "Anterior" deja corregir. Si llega desde el botón del correo,
 * la primera ya está contestada y arranca en la segunda.
 *
 * Sin JavaScript se ve todo junto en una página y funciona igual: los pasos
 * los arma el script, y el envío es un formulario común.
 */
function formulario(pila: string, puesto: string, elegidas: Record<string, string> = {}, error = ''): Response {
  const total = PREGUNTAS_SEGUIMIENTO.length;
  const pasos = PREGUNTAS_SEGUIMIENTO.map(
    (p, n) => `
    <fieldset class="paso">
      <legend>${escapar(p.pregunta(pila))}</legend>
      <div class="opciones">
        ${p.opciones
          .map((o, i) => {
            const punto = PUNTOS[p.campo]?.[i];
            return `<label><input type="radio" name="${p.campo}" value="${escapar(o)}" required${
              elegidas[p.campo] === o ? ' checked' : ''
            } /><span>${punto ? `<i style="background:${punto}" aria-hidden="true"></i>` : ''}${escapar(o)}</span></label>`;
          })
          .join('\n        ')}
      </div>
    </fieldset>`
  ).join('');
  return documento(
    `Cómo le va a ${pila}`,
    `<h1>¿Cómo le va a ${escapar(pila)}?</h1>
    <p>Hace noventa días empezó a trabajar con ustedes${puesto ? ` como ${escapar(puesto)}` : ''}. Son tres preguntas de opción múltiple y un comentario si querés agregar algo.</p>
    ${error ? `<p class="error">${escapar(error)}</p>` : ''}
    <form method="post" id="encuesta">
      <div class="progreso" aria-live="polite">
        <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0"><div></div></div>
        <span class="cuenta"></span>
      </div>
      ${pasos}
      <fieldset class="paso">
        <legend>¿Algo que quieras contarnos?</legend>
        <textarea name="comentario" maxlength="${LARGO_COMENTARIO}" placeholder="Opcional: qué anduvo bien, qué costó, qué no esperaban.">${escapar(elegidas.comentario ?? '')}</textarea>
        <button type="submit">Enviar</button>
      </fieldset>
      <button type="button" class="atras" hidden>← Anterior</button>
    </form>
    <script>
    (function () {
      var form = document.getElementById('encuesta');
      var pasos = Array.prototype.slice.call(form.querySelectorAll('.paso'));
      var atras = form.querySelector('.atras');
      var barra = form.querySelector('.barra');
      var relleno = barra.firstElementChild;
      var cuenta = form.querySelector('.cuenta');
      var total = pasos.length - 1;
      var actual = 0;
      document.documentElement.classList.add('js');
      // Los pasos ocultos no pueden tener campos obligatorios: el navegador no
      // puede señalarlos. Lo que falte se controla al enviar, acá y en el servidor.
      form.querySelectorAll('[required]').forEach(function (el) { el.removeAttribute('required'); });
      function ir(n) {
        actual = Math.max(0, Math.min(n, pasos.length - 1));
        pasos.forEach(function (p, i) { p.classList.toggle('activo', i === actual); });
        atras.hidden = actual === 0;
        // La barra cuenta lo respondido; el texto dice dónde está parado.
        var hechas = pasos.slice(0, total).filter(function (p) { return p.querySelector('input:checked'); }).length;
        relleno.style.width = (100 * hechas / total) + '%';
        barra.setAttribute('aria-valuenow', String(hechas));
        cuenta.textContent = actual < total
          ? 'Pregunta ' + (actual + 1) + ' de ' + total
          : 'Las ' + total + ' preguntas respondidas · falta enviar';
        var foco = pasos[actual].querySelector('input:checked, input, textarea');
        if (foco && actual === pasos.length - 1) foco.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      function sinContestar() {
        for (var i = 0; i < pasos.length - 1; i++) if (!pasos[i].querySelector('input:checked')) return i;
        return -1;
      }
      pasos.forEach(function (p, i) {
        p.addEventListener('change', function (ev) {
          if (ev.target.type !== 'radio') return;
          setTimeout(function () { ir(i + 1); }, 220);
        });
      });
      atras.addEventListener('click', function () { ir(actual - 1); });
      form.addEventListener('submit', function (ev) {
        var falta = sinContestar();
        if (falta >= 0) { ev.preventDefault(); ir(falta); }
      });
      var primera = sinContestar();
      ir(primera < 0 ? pasos.length - 1 : primera);
    })();
    </script>`,
    error ? 400 : 200
  );
}

type Contexto = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Contexto) {
  const { token } = await params;
  const e = await porToken(token);
  if (!e) return noEsta();
  if (e.respondido) return gracias();
  // El botón del correo trae la primera respuesta elegida (?d=0 a 2): llega marcada.
  // Sin el parámetro no se marca nada: Number(null) es 0 y marcaba la primera.
  const crudo = new URL(req.url).searchParams.get('d');
  const d = crudo && /^\d$/.test(crudo) ? Number(crudo) : -1;
  const desde = EN_EL_CORREO.opciones[d] ? { [EN_EL_CORREO.campo]: EN_EL_CORREO.opciones[d] } : {};
  return formulario(e.pila, e.puesto, desde);
}

export async function POST(req: Request, { params }: Contexto) {
  const { token } = await params;
  const e = await porToken(token);
  if (!e) return noEsta();

  const datos = await req.formData().catch(() => null);
  const respuestas: Record<string, string> = {};
  for (const [k, v] of datos?.entries() ?? []) if (typeof v === 'string') respuestas[k] = v;

  const r = await responder(token, respuestas);
  if (!r.ok) return formulario(e.pila, e.puesto, respuestas, 'Falta contestar alguna de las tres preguntas.');
  return gracias();
}
