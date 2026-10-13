import Link from 'next/link';
import Shell from '../Shell';
import CopiarLinkLaminas from './CopiarLinkLaminas';
import { TOKEN_DEMO } from '@/lib/portal-demo';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const metadata = { title: 'Herramientas — Campos OS' };

type Ficha = {
  titulo: string;
  detalle: string;
  href: string;
  icono: keyof typeof DIBUJOS;
};

/**
 * El dibujo de cada tarjeta, en trazo y sin relleno, todos sobre la misma
 * grilla de 24: así se reconoce la herramienta antes de leer el título.
 */
const DIBUJOS = {
  // Una mancha simétrica, que es lo que la lámina es.
  manchas: (
    <>
      <path d="M12 4C9 2 5 4 6 8c-3 1-4 5-1 7-1 3 3 5 7 3" />
      <path d="M12 4c3-2 7 0 6 4 3 1 4 5 1 7 1 3-3 5-7 3" />
      <path d="M12 8v6" />
    </>
  ),
  // Las tres láminas, una al lado de la otra.
  tres: (
    <>
      <rect x="2.5" y="6" width="5" height="12" rx="1" />
      <rect x="9.5" y="6" width="5" height="12" rx="1" />
      <rect x="16.5" y="6" width="5" height="12" rx="1" />
    </>
  ),
  lapiz: (
    <>
      <path d="M4 20l1-4L16 5l3 3L8 19z" />
      <path d="M14 7l3 3" />
    </>
  ),
  // La matriz de tres por tres, con el último lugar vacío.
  matriz: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v12M3 9h18M3 15h12" />
    </>
  ),
  curva: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 17c5-1 9-5 12-11" />
    </>
  ),
  ventana: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M6.5 7h.01M9 7h.01" />
    </>
  ),
  rueda: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3" />
    </>
  ),
  caja: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
      <path d="M10 12v2.5h4V12" />
    </>
  ),
};

function Icono({ cual }: { cual: keyof typeof DIBUJOS }) {
  return (
    <svg
      className="os-tarjeta-icono"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {DIBUJOS[cual]}
    </svg>
  );
}

const FICHAS: Ficha[] = [
  {
    titulo: 'Rorschach',
    detalle: 'Las 10 láminas a pantalla completa.',
    href: '/os/laminas/rorschach',
    icono: 'manchas',
  },
  {
    titulo: 'Zulliger',
    detalle: 'Las 3 láminas, en la misma pantalla.',
    href: '/os/laminas/zulliger',
    icono: 'tres',
  },
  {
    titulo: 'Bender',
    detalle: 'Las 9 figuras para copiar.',
    href: '/os/laminas/bender',
    icono: 'lapiz',
  },
  {
    titulo: 'Raven',
    detalle: 'Vista de prueba, sin guardar nada.',
    href: '/raven',
    icono: 'matriz',
  },
  {
    titulo: 'Progreso del potencial',
    detalle: 'La lámina de Jaques, con edad y horizonte.',
    href: '/os/potencial',
    icono: 'curva',
  },
  {
    titulo: 'Portal de prueba',
    detalle: 'El portal como lo ve un cliente.',
    href: `https://clientes.camposhr.com/${TOKEN_DEMO}`,
    icono: 'ventana',
  },
  {
    titulo: 'Rueda de emociones',
    detalle: 'Se completa en el teléfono.',
    href: '/rueda',
    icono: 'rueda',
  },
];

export default async function Herramientas() {
  const yo = await quienSoy();
  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell identidad={yo.nombre} titulo="Herramientas" cuentas={cuentas} nota={`${FICHAS.length} en uso`}>
      <div className="os-encabezado">
        <h1>Lo que se usa para trabajar</h1>
        <p>
          Las pantallas que se abren desde el OS. El material de los encuentros
          vive en Tools: presentaciones, cuestionario de perfil e informes de
          clientes.
        </p>
      </div>

      <div className="os-tarjetas os-tarjetas-bajas">
        {FICHAS.map((f) => {
          const tarjeta = (
            <Link className="os-tarjeta" key={f.titulo} href={f.href}>
              <Icono cual={f.icono} />
              <h3>{f.titulo}</h3>
              <p>{f.detalle}</p>
            </Link>
          );
          // Los tests con láminas llevan el enlace para la persona evaluada:
          // la dirección de la tarjeta pide la clave del OS y a ella no le abre.
          // El del Raven es otro: abre la vista de prueba, que no guarda nada,
          // y por eso no dice "para el candidato". El que rinde un candidato
          // sale de su hoja de entrevista.
          const deRaven = f.href === '/raven';
          const test = deRaven ? 'raven' : f.href.match(/^\/os\/laminas\/([a-z]+)$/)?.[1];
          if (!test) return tarjeta;
          return (
            <div className="os-tarjeta-con-link" key={f.titulo}>
              {tarjeta}
              <CopiarLinkLaminas test={test} texto={deRaven ? 'Copiar link de prueba' : undefined} />
            </div>
          );
        })}
        {/* Tools es otro sitio y no una pantalla del OS: va último, con su
            dibujo, para que no se lea como una herramienta más de la lista. */}
        <a
          className="os-tarjeta"
          href="https://tools.camposhr.com"
          target="_blank"
          rel="noreferrer"
        >
          <Icono cual="caja" />
          <h3>Ir a Tools</h3>
          <p>Presentaciones, cuestionario e informes.</p>
        </a>
      </div>
    </Shell>
  );
}
