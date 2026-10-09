/**
 * Política de privacidad de Campos OS, en camposhr.com/privacidad.
 *
 * Existe porque Google la pide para pasar la aplicación de "Prueba" a
 * producción: su dirección va cargada en la pantalla de consentimiento. Dice
 * qué recibe el OS cuando una evaluadora conecta su calendario
 * (`lib/google-calendario.ts`, `lib/google-contactos.ts`) y qué hace con eso; si cambia el permiso que se
 * pide, cambia este texto.
 *
 * Se sirve como documento entero y no como pantalla de la aplicación, para que
 * lleve la tipografía y los colores de la home (`public/home.html`) sin cargar
 * los estilos del OS.
 */

const CONTACTO = 'agusmilesi@gmail.com';

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Política de privacidad de Campos OS. Campos HR</title>
  <meta name="description" content="Qué datos de Google usa Campos OS, el sistema interno de Campos HR, para qué los usa y cómo se retira el permiso." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap"
    rel="stylesheet"
  />
  <style>
    :root {
      --papel: #f6f5f2;
      --tinta: #16202b;
      --suave: #7b7770;
      --linea: #ddd9d2;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--papel);
      color: var(--tinta);
      line-height: 1.42;
      letter-spacing: -0.006em;
      padding: 0 24px;
    }
    .hoja {
      max-width: 600px;
      margin: 0 auto;
      padding: 64px 0 72px;
    }
    .marca {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 1.35rem;
      letter-spacing: -0.022em;
      padding-bottom: 44px;
    }
    .marca a { color: inherit; text-decoration: none; }
    .marca .bajada { color: var(--suave); }
    h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: clamp(1.7rem, 7.4vw, 2.6rem);
      font-weight: 400;
      line-height: 1.06;
      letter-spacing: -0.03em;
    }
    .entrada {
      margin-top: 18px;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #3c4650;
    }
    .punto {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--linea);
    }
    .punto h2 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 1.35rem;
      font-weight: 400;
      line-height: 1.1;
      letter-spacing: -0.024em;
    }
    .punto p {
      margin-top: 8px;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #3c4650;
    }
    a { color: var(--tinta); text-decoration: none; border-bottom: 1px solid var(--linea); }
    a:hover { border-bottom-color: var(--tinta); }
    .marca a, .marca a:hover { border-bottom: 0; }
    @media (max-width: 34rem) {
      body { padding: 0 20px; }
      .hoja { padding: 40px 0 52px; }
      .marca { padding-bottom: 32px; }
    }
  </style>
</head>
<body>
  <div class="hoja">

    <div class="marca"><a href="/">Campos HR. <span class="bajada">Bienestar Corporativo</span></a></div>

    <h1>Política de privacidad de Campos OS</h1>
    <p class="entrada">Campos OS es el sistema interno de Campos HR. Lo usa únicamente el equipo de Campos HR.</p>

    <div class="punto">
      <h2>Qué datos de Google usa</h2>
      <p>Cuando una integrante del equipo conecta su cuenta de Google, Campos OS recibe su dirección de correo, un permiso para ver y editar los eventos de su Google Calendar y un permiso sobre sus contactos de Google.</p>
    </div>

    <div class="punto">
      <h2>Para qué los usa</h2>
      <p>Para crear, mover y borrar en ese calendario los eventos de las entrevistas que la persona agenda en Campos OS, y para crear la sala de Google Meet de las entrevistas en línea. Campos OS no lee, modifica ni borra otros eventos del calendario. El permiso de contactos se usa únicamente para crear el contacto de la persona a entrevistar (nombre, teléfono, correo y empresa) cuando la integrante del equipo le escribe para coordinar la entrevista. Campos OS no lee, modifica ni borra los contactos que ya existen en la cuenta.</p>
    </div>

    <div class="punto">
      <h2>Dónde se guardan</h2>
      <p>El permiso y la dirección de correo se guardan en la base de datos de Campos HR, con acceso restringido al servidor del sistema.</p>
    </div>

    <div class="punto">
      <h2>Con quién se comparten</h2>
      <p>Con nadie. Los datos recibidos de Google no se venden, no se ceden a terceros y no se usan para publicidad ni para entrenar modelos de inteligencia artificial.</p>
    </div>

    <div class="punto">
      <h2>Cómo se retira el permiso</h2>
      <p>Desde Campos OS, en Configuración → Google → Desconectar, o desde la cuenta de Google en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. Al desconectar, Campos OS borra el permiso guardado.</p>
    </div>

    <div class="punto">
      <h2>Contacto</h2>
      <p><a href="mailto:${CONTACTO}">${CONTACTO}</a></p>
    </div>

  </div>
</body>
</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
