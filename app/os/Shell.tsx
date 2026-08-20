'use client';

/**
 * El marco del OS: barra lateral con las secciones, barra superior y los dos
 * temas.
 *
 * El tema y el plegado se guardan en el atributo de <html> y no en estado de
 * React, porque el script de app/os/layout.tsx los escribe antes de que React
 * monte. Así no hay destello al entrar ni salto al navegar entre secciones.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Identidad from './Identidad';

type Seccion = { href: string; texto: string; icono: keyof typeof ICONOS };
/** Un grupo sin título va suelto arriba, sin encabezado. */
type Grupo = { grupo: string | null; items: Seccion[] };

const NAV: Grupo[] = [
  {
    grupo: null,
    items: [{ href: '/os', texto: 'Inicio', icono: 'inicio' }],
  },
  {
    // Las etapas son la sección: es el orden en que pasa una evaluación, y
    // cada una es la pantalla donde se hace ese tramo del trabajo.
    grupo: 'Psicotécnicos',
    items: [
      { href: '/os/psicotecnicos/sin-asignar', texto: 'Sin asignar', icono: 'sinAsignar' },
      { href: '/os/psicotecnicos/entrevistas', texto: 'Entrevistas', icono: 'agenda' },
      { href: '/os/psicotecnicos/por-analizar', texto: 'Por analizar', icono: 'escribir' },
      { href: '/os/psicotecnicos/entregados', texto: 'Entregados', icono: 'listo' },
    ],
  },
  {
    grupo: 'Sentir Mindfulness',
    items: [{ href: '/os/encuentros', texto: 'Encuentros', icono: 'encuentros' }],
  },
  {
    grupo: 'Comercial',
    items: [
      { href: '/os/clientes', texto: 'Clientes', icono: 'clientes' },
      { href: '/os/cotizaciones', texto: 'Cotizaciones', icono: 'cotizaciones' },
      { href: '/os/costos', texto: 'Costos', icono: 'costos' },
      { href: '/os/accesos', texto: 'Accesos', icono: 'accesos' },
    ],
  },
  {
    grupo: 'Sistema',
    items: [
      { href: '/os/baterias', texto: 'Baterías', icono: 'costos' },
      { href: '/os/herramientas', texto: 'Herramientas', icono: 'herramientas' },
      { href: '/os/especificaciones', texto: 'Especificaciones', icono: 'specs' },
    ],
  },
];

const ICONOS = {
  inicio: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  clientes: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></>,
  resumen: <><path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="3" height="5" /><rect x="13" y="7" width="3" height="9" /></>,
  sinAsignar: <><circle cx="12" cy="8" r="3.2" strokeDasharray="3 2.4" /><path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" strokeDasharray="3 2.4" /></>,
  telefono: <><path d="M6.5 3h3l1.6 4-2 1.4a12 12 0 0 0 5.5 5.5l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" /></>,
  agenda: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M8.5 14.5h3" /></>,
  escribir: <><path d="M19 13v7H5V4h7" /><path d="M15.5 4.5 20 9l-6 6h-4v-4z" /></>,
  costos: <><path d="M3.5 19.5V8.5" /><path d="M3.5 19.5h17" /><path d="M7.5 19.5v-6" /><path d="M12 19.5V6.5" /><path d="M16.5 19.5v-9" /></>,
  cargar: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8.2v7.6" /><path d="M8.2 12h7.6" /></>,
  listo: <><circle cx="12" cy="12" r="8.5" /><path d="M8.4 12.2l2.6 2.6 4.7-5" /></>,
  encuentros: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M18 20c0-2.4-1-4.5-2.6-5.6" /></>,
  cotizaciones: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 13h6" /><path d="M9 17h6" /></>,
  accesos: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  herramientas: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  specs: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 9h6" /><path d="M9 13h6" /><path d="M9 17h3" /></>,
};

function Icono({ nombre }: { nombre: keyof typeof ICONOS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[nombre]}
    </svg>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Quién está mirando, con su foto.
 *
 * La foto se pide una vez por nombre. Mientras no esté subida, y hoy no lo está
 * para nadie, quedan las iniciales, que ya alcanzan para saber con qué
 * identidad se está trabajando.
 */
function QuienMira({ nombre, soloFoto }: { nombre: string; soloFoto?: boolean }) {
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/os/foto?nombre=${encodeURIComponent(nombre)}`)
      .then((r) => r.json())
      .then((d) => vivo && setFoto(d.url ?? null))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [nombre]);

  return (
    <div className="os-quien" title={nombre}>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="os-quien-foto" src={foto} alt="" />
      ) : (
        <span className="os-quien-foto os-quien-iniciales">{iniciales(nombre)}</span>
      )}
      {!soloFoto && <span className="os-quien-nombre">{nombre}</span>}
    </div>
  );
}

/**
 * La fecha y la hora de acá.
 *
 * Se arma en el navegador y no en el servidor a propósito: el servidor corre en
 * otro huso y mostraría una hora que no es la de quien mira. Por eso arranca
 * vacío y se llena al montar, que además evita que el texto del servidor y el
 * del navegador no coincidan.
 */
function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!ahora) return <span className="os-reloj" />;

  const fecha = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(ahora);
  // 24 horas: es el formato con el que se agenda una entrevista.
  const hora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ahora);

  return (
    <span className="os-reloj">
      {fecha} · {hora}
    </span>
  );
}

/** Todos los destinos de la barra, para saber si alguno da exacto. */
const DESTINOS = NAV.flatMap((g) => g.items.map((i) => i.href));

/**
 * Se prende una sola sección: la que se está mirando.
 *
 * Antes alcanzaba con que la ruta empezara igual, y eso dejaba prendido el
 * Resumen mientras se miraba cualquier etapa, porque todas cuelgan de su
 * dirección. El prefijo se conserva únicamente para una pantalla que no tiene
 * renglón propio, así no queda la barra entera apagada.
 */
function esActiva(href: string, ruta: string): boolean {
  if (ruta === href) return true;
  if (href === '/os' || DESTINOS.includes(ruta)) return false;
  return ruta.startsWith(`${href}/`);
}

export default function Shell({
  titulo,
  nota,
  cuentas,
  avisos,
  identidad,
  ancho,
  children,
}: {
  titulo: string;
  nota?: string;
  /** Número al costado de una sección, por href. */
  cuentas?: Record<string, number>;
  /**
   * Secciones cuyo número va en círculo, por href.
   *
   * Es para lo que entró y todavía no tomó nadie: se ve desde cualquier
   * pantalla, sin tener que entrar a mirar si hay algo nuevo.
   */
  avisos?: string[];
  /** Con quién se está trabajando. Ver lib/identidad.ts. */
  identidad: string;
  /** Sin el ancho de lectura: para una tabla, que necesita todo el espacio. */
  ancho?: boolean;
  children: React.ReactNode;
}) {
  const ruta = usePathname() ?? '/os';
  const [menu, setMenu] = useState(false);

  // El cajón del teléfono se cierra solo al cambiar de sección.
  useEffect(() => {
    setMenu(false);
  }, [ruta]);

  useEffect(() => {
    const html = document.documentElement;
    if (menu) html.setAttribute('data-os-menu', 'abierta');
    else html.removeAttribute('data-os-menu');
  }, [menu]);

  function cambiarTema() {
    const html = document.documentElement;
    const nuevo = html.getAttribute('data-os-tema') === 'oscuro' ? 'claro' : 'oscuro';
    html.setAttribute('data-os-tema', nuevo);
    try {
      localStorage.setItem('os-tema', nuevo);
    } catch {}
  }

  function plegar() {
    // En el teléfono el mismo botón abre y cierra el cajón.
    if (window.matchMedia('(max-width: 760px)').matches) {
      setMenu((v) => !v);
      return;
    }
    const html = document.documentElement;
    const compacta = html.getAttribute('data-os-lateral') === 'compacta';
    if (compacta) html.removeAttribute('data-os-lateral');
    else html.setAttribute('data-os-lateral', 'compacta');
    try {
      localStorage.setItem('os-lateral', compacta ? 'ancha' : 'compacta');
    } catch {}
  }

  return (
    <div className="os">
      <aside className="os-lateral">
        <div className="os-marca">
          <div className="os-sello" aria-hidden="true">CH</div>
          <div className="os-marca-texto">
            <div className="os-marca-nombre">Campos <em>OS</em></div>
            <div className="os-marca-bajada">Equipo interno</div>
          </div>
        </div>

        <nav className="os-nav">
          {NAV.map((g) => (
            <div key={g.grupo ?? 'suelto'}>
              {g.grupo && <div className="os-grupo">{g.grupo}</div>}
              {g.items.map((s) => {
                const n = cuentas?.[s.href];
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="os-item"
                    aria-current={esActiva(s.href, ruta) ? 'page' : undefined}
                  >
                    <Icono nombre={s.icono} />
                    <span>{s.texto}</span>
                    {typeof n === 'number' && n > 0 && (
                  <span
                    className={`os-item-cuenta${
                      avisos?.includes(s.href) ? ' os-item-aviso' : ''
                    }`}
                  >
                    {n}
                  </span>
                )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="os-pie">
          <div className="os-pie-quien">
            <QuienMira nombre={identidad} soloFoto />
            <Identidad actual={identidad} />
          </div>
          <button type="button" className="os-boton-pie" onClick={cambiarTema}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
            </svg>
            <span>Tema</span>
            <span className="os-switch" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="os-velo"
        aria-label="Cerrar el menú"
        onClick={() => setMenu(false)}
      />

      <div className="os-cuerpo">
        <header className="os-barra">
          {/* El interior mide lo mismo que el contenido de abajo, así el reloj
              termina donde termina la última caja y no contra el borde. */}
          <div className={`os-barra-interior${ancho ? ' os-barra-interior-ancho' : ''}`}>
            <button type="button" className="os-plegar" onClick={plegar} aria-label="Plegar la barra lateral">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
              </svg>
            </button>
            <div className="os-barra-titulo">{titulo}</div>
            <div className="os-barra-lado">
              {nota && <span className="os-barra-nota">{nota}</span>}
              <Reloj />
            </div>
          </div>
        </header>
        <main className={`os-contenido${ancho ? ' os-contenido-ancho' : ''}`}>{children}</main>
      </div>
    </div>
  );
}
