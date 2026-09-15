/**
 * Lo que comparten las tres pestañas de la página de honorarios: las
 * pestañas, el equipo y los íconos de contacto.
 */

export const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Las pestañas, como enlaces y no como botones: cada una tiene su dirección
 * (`/psicotecnicos?servicio=coaching`), así que se puede mandar por WhatsApp la
 * pestaña que corresponde y no la página entera.
 */
export const PESTANAS = [
  { clave: 'psicotecnicos', rotulo: 'Evaluaciones psicotécnicas', href: '/psicotecnicos' },
  { clave: 'coaching', rotulo: 'Coaching laboral', href: '/psicotecnicos?servicio=coaching' },
  {
    clave: 'entrevistas',
    rotulo: 'Entrevistas y referencias',
    href: '/psicotecnicos?servicio=entrevistas',
  },
] as const;

export type ClavePestana = (typeof PESTANAS)[number]['clave'];

export function Pestanas({ activa }: { activa: ClavePestana }) {
  return (
    <nav className="precios-pestanas" aria-label="Servicios">
      {PESTANAS.map((p) => (
        <a key={p.clave} href={p.href} aria-current={p.clave === activa ? 'page' : undefined}>
          {p.rotulo}
        </a>
      ))}
    </nav>
  );
}

/**
 * Quiénes firman los informes.
 *
 * Escrito acá y no leído de `evaluadoras`, que solo guarda el nombre: la
 * matrícula y la formación son datos de venta y no del pipeline. Salen de las
 * bios que ya se publican en el sitio de Sentir, sin la parte de mindfulness:
 * acá se está contratando un psicotécnico, y la formación que lo sostiene es la
 * clínica y la organizacional.
 */
const EQUIPO = [
  {
    nombre: 'Lorena Campos',
    foto: '/equipo/lorena-campos.png',
    titulo: 'Lic. en Psicología · Mat. 5217',
    linkedin: 'https://www.linkedin.com/in/lorecamposhr/',
    bio: 'Especialista en Psicología Cognitiva y licenciataria del BZG Thinking Styles Assessment. Desde 2009 trabaja en el ámbito organizacional, acompañando empresas locales, nacionales y multinacionales en liderazgo, gestión de personas y procesos soft.',
  },
  {
    nombre: 'Lucila Campos',
    foto: '/equipo/lucila-campos.png',
    titulo: 'Lic. en Psicología · Mat. 6338',
    linkedin: 'https://www.linkedin.com/in/lulicamposhr/',
    bio: 'Especialista en Psicología Cognitiva. Desde 2013 trabaja en clínica con adultos y trastornos de ansiedad, y combina esa experiencia con psicología organizacional en empresas.',
  },
];

export function IconoWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z"
      />
    </svg>
  );
}

function IconoLinkedin() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"
      />
    </svg>
  );
}

/**
 * Quiénes firman, con nombre, matrícula y cara. En una decisión así lo que se
 * compra es el criterio de quien firma, y un informe sin autor identificable
 * vale menos que uno con matrícula al pie.
 */
export function Equipo({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <section className="precios-bloque">
      <h2 className="precios-titulo">{titulo}</h2>
      <div className="precios-equipo">
        {EQUIPO.map((p) => (
          <article className="precios-persona" key={p.nombre}>
            <img
              className="precios-foto"
              src={p.foto}
              alt={`Foto de ${p.nombre}`}
              width={150}
              height={150}
              loading="lazy"
            />
            <div>
              <h3 className="precios-persona-nombre">{p.nombre}</h3>
              <p className="precios-persona-titulo">
                {p.titulo}
                {/* El perfil profesional y no el correo: acá se está mirando
                    quién firma, y en LinkedIn está la trayectoria entera.
                    Escribirles es un paso posterior y tiene su lugar en el
                    proceso. */}
                <a
                  className="precios-linkedin"
                  href={p.linkedin}
                  aria-label={`LinkedIn de ${p.nombre}`}
                  title={`LinkedIn de ${p.nombre}`}
                >
                  <IconoLinkedin />
                  LinkedIn
                </a>
              </p>
              <p className="precios-persona-bio">{p.bio}</p>
            </div>
          </article>
        ))}
      </div>
      {nota && <p className="precios-nota">{nota}</p>}
    </section>
  );
}
