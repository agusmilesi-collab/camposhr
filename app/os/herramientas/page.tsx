import Link from 'next/link';
import Shell from '../Shell';
import { TOKEN_DEMO } from '@/lib/portal-demo';
import { quienSoy } from '@/lib/identidad';

export const metadata = { title: 'Herramientas — Campos OS' };

type Ficha = {
  rotulo: string;
  titulo: string;
  detalle: string;
  href: string;
};

const FICHAS: Ficha[] = [
  {
    rotulo: 'Test proyectivo',
    titulo: 'Rorschach',
    detalle:
      'Las 10 láminas a pantalla completa, con puntero de señalización y pincel que se desvanece solo. Se comparte la pantalla con la persona evaluada.',
    href: '/os/laminas/rorschach',
  },
  {
    rotulo: 'Test proyectivo',
    titulo: 'Zulliger',
    detalle:
      'Variante de 3 láminas, con la misma pantalla de señalización. Para evaluaciones grupales o entrevistas de tiempo limitado.',
    href: '/os/laminas/zulliger',
  },
  {
    rotulo: 'Test de razonamiento',
    titulo: 'Raven',
    detalle:
      '36 láminas con ocho opciones y 45 minutos de reloj. El candidato lo responde por su enlace y el puntaje entra solo en su ficha. Acá se ve como lo ve él, sin guardar nada.',
    href: '/raven',
  },
  {
    rotulo: 'Portal de clientes',
    titulo: 'Portal de prueba',
    detalle:
      'El portal como lo ve un cliente, con una empresa inventada. Para mirar una pantalla antes de mostrársela a un cliente de verdad. El enlace de cada cliente real está en su fila, en Clientes.',
    href: `https://clientes.camposhr.com/${TOKEN_DEMO}`,
  },
  {
    rotulo: 'Perfiles de equipo',
    titulo: 'Cuestionario de perfil',
    detalle:
      'Cada persona responde por QR desde el celular y la matriz de cuadrantes se arma en vivo para proyectarla en el encuentro.',
    href: '/cuestionario',
  },
  {
    rotulo: 'Material de los encuentros',
    titulo: 'Presentaciones',
    detalle:
      'Las placas de cada charla, con las notas del orador adentro. Se descargan y funcionan sin internet.',
    href: '/presentaciones',
  },
  {
    rotulo: 'Ejercicios de sala',
    titulo: 'Rueda y pasos',
    detalle:
      'Las dos actividades que se resuelven en el teléfono y se guardan como imagen.',
    href: '/rueda',
  },
];

export default async function Herramientas() {
  const yo = await quienSoy();
  return (
    <Shell identidad={yo.nombre} titulo="Herramientas" nota={`${FICHAS.length} en uso`}>
      <div className="os-encabezado">
        <h1>Lo que se usa para trabajar</h1>
        <p>
          Las herramientas que ya funcionan, todas adentro del OS.
        </p>
      </div>

      <div className="os-tarjetas">
        {FICHAS.map((f) => (
          <Link className="os-tarjeta" key={f.titulo} href={f.href}>
            <div className="os-tarjeta-rotulo">{f.rotulo}</div>
            <h3>{f.titulo}</h3>
            <p>{f.detalle}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
