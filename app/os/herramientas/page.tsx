import Link from 'next/link';
import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';

export const metadata = { title: 'Herramientas — Campos OS' };

const TOOLS = 'https://tools.camposhr.com';

type Ficha = {
  rotulo: string;
  titulo: string;
  detalle: string;
  href: string;
  externa?: boolean;
};

const FICHAS: Ficha[] = [
  {
    rotulo: 'Test proyectivo',
    titulo: 'Rorschach',
    detalle:
      '12 láminas con puntero de señalización y pincel temporal. Administración remota: se comparte el enlace y se ven los gestos del entrevistado sobre la placa.',
    href: `${TOOLS}/test-rorschach/`,
    externa: true,
  },
  {
    rotulo: 'Test proyectivo',
    titulo: 'Zulliger',
    detalle:
      'Variante de 3 láminas, con la misma dinámica de señalización. Para evaluaciones grupales o entrevistas de tiempo limitado.',
    href: `${TOOLS}/test-zulliger/`,
    externa: true,
  },
  {
    rotulo: 'Test de razonamiento',
    titulo: 'Raven',
    detalle:
      '36 láminas con ocho opciones y 45 minutos de reloj. El candidato lo responde por su enlace y el puntaje entra solo en su ficha. Acá se ve como lo ve él, sin guardar nada.',
    href: '/raven',
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
          Las herramientas que ya funcionan. Las que abren en otro subdominio
          siguen viviendo en el hub viejo hasta que se muden acá.
        </p>
      </div>

      <div className="os-tarjetas">
        {FICHAS.map((f) =>
          f.externa ? (
            <a className="os-tarjeta" key={f.titulo} href={f.href} target="_blank" rel="noreferrer">
              <div className="os-tarjeta-rotulo">{f.rotulo}</div>
              <h3>{f.titulo}</h3>
              <p>{f.detalle}</p>
            </a>
          ) : (
            <Link className="os-tarjeta" key={f.titulo} href={f.href}>
              <div className="os-tarjeta-rotulo">{f.rotulo}</div>
              <h3>{f.titulo}</h3>
              <p>{f.detalle}</p>
            </Link>
          )
        )}
      </div>
    </Shell>
  );
}
