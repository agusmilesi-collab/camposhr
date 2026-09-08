'use client';

/**
 * La barra lateral: quién es, dónde está y cómo se sale.
 *
 * Con la misma forma que la del OS, porque es el mismo sistema visto desde el
 * otro lado del mostrador: el sello con las iniciales, el nombre en serifa, la
 * bajada en versalita, los ítems con ícono y el pie separado abajo. Lo que
 * cambia son los colores, que salen de las variables de esta zona.
 *
 * En el teléfono vuelve arriba, en una fila: una columna fija de doscientos
 * píxeles sobre una pantalla de trescientos sesenta se come el calendario.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Las secciones, agrupadas como en el OS: lo suelto arriba y lo demás bajo su
 * rótulo.
 *
 * **Mis turnos y Pacientes todavía no existen.** Están en la barra porque es lo
 * que se viene (la agenda de la consulta y las fichas), y verlas ahí es lo que
 * hace que alguien pregunte por ellas. Cada una abre su pantalla, que dice que
 * se está construyendo en vez de dar un 404.
 */
const NAV: { grupo?: string; items: { href: string; texto: string; icono: React.ReactNode }[] }[] = [
  {
    items: [
      {
        href: '/centro/inicio',
        texto: 'Inicio',
        // La casita.
        icono: (
          <>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
          </>
        ),
      },
    ],
  },
  {
    grupo: 'Mi consulta',
    items: [
      {
        href: '/centro/turnos',
        texto: 'Mis turnos',
        // Un reloj: son horas con una persona del otro lado.
        icono: (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5.5l3.5 2" />
          </>
        ),
      },
      {
        href: '/centro/pacientes',
        texto: 'Pacientes',
        // Dos personas.
        icono: (
          <>
            <path d="M16 20v-1.5a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20" />
            <circle cx="9.2" cy="7.5" r="3.5" />
            <path d="M21.5 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75" />
          </>
        ),
      },
    ],
  },
  {
    grupo: 'Consultorio',
    items: [
      {
        href: '/centro',
        texto: 'Reservar',
        // El calendario: una hoja con la grilla de los días.
        icono: (
          <>
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
            <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
          </>
        ),
      },
      {
        href: '/centro/cuenta',
        texto: 'Mi cuenta',
        // El resumen: una hoja con sus renglones.
        icono: (
          <>
            <path d="M6 2.5h8l5 5v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2z" />
            <path d="M14 2.5v5h5M8.5 13h7M8.5 17h4" />
          </>
        ),
      },
    ],
  },
];

export default function Barra({ nombre, donde }: { nombre: string; donde: string }) {
  const router = useRouter();

  async function salir() {
    await fetch('/api/centro/salir', { method: 'POST' });
    router.push('/centro/entrar');
    router.refresh();
  }

  return (
    <aside className="centro-lateral">
      <div className="centro-marca">
        {/* Las iniciales del Centro y no las de quien entró: el sello es la
            marca del lugar, como el "CH" del OS. Quién entró está en el pie. */}
        <div className="centro-sello" aria-hidden="true">
          CS
        </div>
        <div className="centro-marca-texto">
          <div className="centro-marca-nombre">
            Centro <em>Santiago</em>
          </div>
          <div className="centro-marca-bajada">Consultorios</div>
        </div>
      </div>

      <nav className="centro-nav">
        {NAV.map((g) => (
          <div key={g.grupo ?? 'suelto'}>
            {g.grupo && <div className="centro-grupo">{g.grupo}</div>}
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="centro-menu-item"
                aria-current={donde === i.href ? 'page' : undefined}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {i.icono}
                </svg>
                <span>{i.texto}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="centro-pie">
        <div className="centro-pie-quien">{nombre}</div>
        <button type="button" className="centro-boton-pie" onClick={salir}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>Salir</span>
        </button>
      </div>
    </aside>
  );
}
