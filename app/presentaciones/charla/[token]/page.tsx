import Link from 'next/link';
import { notFound } from 'next/navigation';
import { charlaPorToken, formatoFecha } from '@/lib/presentaciones';
import { corridaDeEmpresa } from '@/lib/presentaciones-encuentros';
import { diasDesde } from '@/lib/hora';

export const dynamic = 'force-dynamic';

/**
 * El hub de una charla suelta: todo lo que se toca el día del encuentro, en
 * una pantalla.
 *
 * El ciclo de cinco encuentros tiene su propia pantalla, con el selector de
 * cliente y el alta. Acá nada de eso hace falta: la charla se dicta una vez,
 * para un cliente, y ese cliente está escrito en el índice. Lo que queda son
 * los tres accesos que se usan con la sala esperando, y son las mismas
 * tarjetas de la portada de tools: ícono arriba, botón abajo.
 *
 * El enlace de la presentación ya lleva el cliente adentro. En el ciclo hay que
 * elegirlo, porque el material es el mismo para varios; acá elegir sería elegir
 * entre una sola opción.
 */

const BASE_PUBLICA = 'https://camposhr.com';

/** Los tres íconos, del mismo trazo que los de la portada de tools. */
const ICONOS = {
  // Una pantalla sobre su pie: lo que se proyecta.
  proyectar: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </>
  ),
  // Perillas de control: lo que se abre y se cierra durante el encuentro.
  conducir: (
    <>
      <path d="M4 21v-6" /><path d="M4 11V3" />
      <path d="M12 21v-9" /><path d="M12 8V3" />
      <path d="M20 21v-4" /><path d="M20 13V3" />
      <path d="M2 15h4" /><path d="M10 12h4" /><path d="M18 17h4" />
    </>
  ),
  // Un papel escrito: lo que la expositora lee.
  guion: (
    <>
      <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8" /><path d="M8 17h5" />
    </>
  ),
  // Un código de cuadros: lo que la sala escanea.
  sala: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" /><path d="M21 14v3" /><path d="M14 21h7" />
    </>
  ),
};

/** El cuadrito con el ícono adentro, arriba de cada acceso. */
function Icono({ dibujo }: { dibujo: keyof typeof ICONOS }) {
  return (
    <div className="hub-acceso-icono" aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONOS[dibujo]}
      </svg>
    </div>
  );
}

/** La flecha del botón, igual a la de la portada. */
function Flecha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Una tarjeta del hub.
 *
 * Sin `href` la tarjeta queda igual, con el botón apagado diciendo qué falta:
 * una que desaparece deja a alguien buscándola el día del encuentro.
 */
function Acceso({
  icono,
  rotulo,
  titulo,
  children,
  accion,
  href,
}: {
  icono: keyof typeof ICONOS;
  rotulo: string;
  titulo: string;
  children: React.ReactNode;
  accion: string;
  href: string | null;
}) {
  return (
    <article className="hub-acceso">
      <Icono dibujo={icono} />
      <div className="hub-acceso-rotulo">{rotulo}</div>
      <h2>{titulo}</h2>
      <p>{children}</p>
      <div className="hub-acceso-pie">
        {href ? (
          <a className="hub-btn" href={href} target="_blank" rel="noreferrer">
            {accion}
            <Flecha />
          </a>
        ) : (
          <span className="hub-btn hub-btn-pronto">{accion}</span>
        )}
      </div>
    </article>
  );
}

/** Cuánto falta, dicho como se dice en voz alta. */
function cuantoFalta(fecha: string): string {
  const faltan = -(diasDesde(fecha) ?? 0);
  if (faltan === 0) return 'Hoy';
  if (faltan === 1) return 'Mañana';
  if (faltan > 1) return `En ${faltan} días`;
  if (faltan === -1) return 'Ayer';
  return `Hace ${-faltan} días`;
}

export default async function Charla({ params }: { params: { token: string } }) {
  const charla = charlaPorToken(params.token);
  if (!charla) notFound();

  const encuentro = charla.cliente ? await corridaDeEmpresa(charla.cliente) : null;
  const cuando = cuantoFalta(charla.fecha);
  const esHoy = cuando === 'Hoy';

  // El deck abre con el cliente adentro: así las respuestas proyectadas salen
  // de la corrida de este encuentro y no de la primera que encuentre.
  const verPresentacion = charla.token
    ? encuentro
      ? `/pres/${charla.token}?c=${encuentro.slug}`
      : `/pres/${charla.token}`
    : null;

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Encuentro</div>
          <Link href="/presentaciones" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Presentaciones
          </Link>
        </div>
        <h1>{charla.titulo}</h1>
      </section>

      <section className={`pres-proxima${esHoy ? ' es-hoy' : ''}`}>
        <span className="pres-proxima-cuando">{cuando}</span>
        <div className="pres-proxima-que">
          <b>{[charla.cliente, formatoFecha(charla.fecha)].filter(Boolean).join(' · ')}</b>
          <span>{charla.subtitulo}</span>
        </div>
        {encuentro && (
          <span className={`enc-fila-estado ${encuentro.abierta ? 'abierta' : ''}`}>
            {encuentro.abierta ? 'Actividad abierta' : 'En reposo'}
          </span>
        )}
      </section>

      <section className="hub-accesos">
        <Acceso
          icono="proyectar"
          rotulo="Para proyectar"
          titulo="Presentación"
          accion={verPresentacion ? 'Abrir las placas' : 'Sin publicar'}
          href={verPresentacion}
        >
          {verPresentacion
            ? `${charla.placas} placas, con las notas del orador adentro. Se abre a pantalla completa y funciona sin internet.`
            : 'La presentación de esta charla todavía no está publicada.'}
        </Acceso>

        <Acceso
          icono="guion"
          rotulo="Para decir"
          titulo="Guion"
          accion="Editar las notas"
          href={`/presentaciones/charla/${params.token}/guion`}
        >
          El guion entero en un campo de texto, para escribirlo y releerlo antes de
          dictar. Arranca con las notas que trae el deck.
        </Acceso>

        <Acceso
          icono="conducir"
          rotulo="Para conducir"
          titulo="Admin"
          accion={encuentro ? 'Abrir el panel' : 'Sin encuentro'}
          href={
            encuentro
              ? `${BASE_PUBLICA}/ciclo/${encuentro.slug}/control?k=${encodeURIComponent(encuentro.clave)}`
              : null
          }
        >
          {encuentro
            ? 'Abrir y cerrar las consignas del teléfono, y ver lo que va entrando. El enlace lleva la clave adentro.'
            : 'Este cliente todavía no tiene un encuentro dado de alta en la base.'}
        </Acceso>

        <Acceso
          icono="sala"
          rotulo="Para la sala"
          titulo="Código QR"
          accion={encuentro ? 'Proyectar el código' : 'Sin encuentro'}
          href={encuentro ? `/ciclo/${encuentro.slug}/qr` : null}
        >
          {encuentro ? (
            <>
              Se proyecta y cada uno entra desde su teléfono a{' '}
              {BASE_PUBLICA.replace(/^https:\/\//, '')}/ciclo/{encuentro.slug}. Van{' '}
              {encuentro.registrados}{' '}
              {encuentro.registrados === 1 ? 'persona registrada' : 'personas registradas'}.
            </>
          ) : (
            'Aparece cuando el encuentro esté dado de alta.'
          )}
        </Acceso>
      </section>
    </main>
  );
}
