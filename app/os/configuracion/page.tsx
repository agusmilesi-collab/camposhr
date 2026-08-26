import Link from 'next/link';
import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import Baterias from './Baterias';
import Baremos from './Baremos';
import Ponderaciones from './Ponderaciones';
import Redacciones from './Redacciones';
import Potencial from './Potencial';
import Exigencia from './Exigencia';

export const dynamic = 'force-dynamic';

/**
 * Lo que se puede mover del sistema sin tocar el código.
 *
 * Cuatro cosas que son criterio y no decisión técnica: qué incluye y qué
 * entrega cada batería, dónde cortan los rangos del Raven, cuánto pesa cada
 * indicador dentro de su competencia y qué escribe el informe para cada
 * lectura. Estaban en cuatro entradas de la barra lateral, y eran cuatro
 * lugares para la misma pregunta.
 *
 * **La pestaña viaja en la dirección** (`?ver=baremos`), igual que en la ficha,
 * así una se puede compartir y recargar. Las direcciones viejas (`/os/baremos`
 * y las otras tres) redirigen a la pestaña que les corresponde.
 *
 * La de los pesos se llama Velocímetro desde el 26/8/2026, que es como se la
 * nombra: de ahí sale el puntaje que marca la aguja de cada competencia en el
 * informe. La clave de la dirección sigue siendo `ponderaciones`, porque está
 * guardada en marcadores y en el redirector de la ruta vieja.
 */

const PESTANAS = [
  { clave: 'baterias', texto: 'Baterías' },
  { clave: 'baremos', texto: 'Baremos' },
  { clave: 'ponderaciones', texto: 'Velocímetro' },
  { clave: 'redacciones', texto: 'Redacciones' },
  { clave: 'potencial', texto: 'Potencial' },
  { clave: 'exigencia', texto: 'Exigencia' },
];

const QUE_HACE: Record<string, string> = {
  baterias: 'Qué se le toma a la persona y qué recibe el cliente, con el precio de cada batería.',
  baremos:
    'Dónde corta cada rango del Raven. Cambia el rango que se nombra en el informe y el puntaje de habilidad cognitiva.',
  ponderaciones:
    'Dónde corta cada indicador entre bajo, medio y alto, y cuánto pesa dentro de su competencia. De acá sale el puntaje que marca el velocímetro de cada una en el informe.',
  redacciones:
    'Lo que el informe escribe cuando una lectura se dispara. Cuándo entra cada una lo decide su índice y su corte.',
  potencial:
    'Los cuatro estratos del análisis discursivo: qué rol abarca cada uno, qué lapso proyecta y qué lo caracteriza. Es lo que se lee al ubicar a la persona en la pirámide.',
};

export default async function Configuracion({
  searchParams,
}: {
  searchParams: { ver?: string };
}) {
  const yo = await quienSoy();
  const pedida = searchParams.ver ?? '';
  const ver = PESTANAS.some((p) => p.clave === pedida) ? pedida : 'baterias';

  return (
    <Shell titulo="Configuración" identidad={yo.nombre} ancho>
      <div className="os-encabezado">
        <h1>Configuración</h1>
        <p>
          Lo que decide cuánto pide el sistema y qué escribe. Rige desde el próximo informe que
          se abra; los ya entregados no se recalculan solos.
        </p>
      </div>

      <nav className="os-pestanas">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/os/configuracion?ver=${p.clave}`}
            className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
            aria-current={ver === p.clave ? 'page' : undefined}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {/* Las pestañas que se explican solas van sin bajada, en vez de con un
          párrafo que repite lo que ya dice la pantalla. */}
      {QUE_HACE[ver] && <p className="os-form-nota os-configuracion-que">{QUE_HACE[ver]}</p>}

      {ver === 'baterias' && <Baterias />}
      {ver === 'baremos' && <Baremos />}
      {ver === 'ponderaciones' && <Ponderaciones />}
      {ver === 'redacciones' && <Redacciones />}
      {ver === 'potencial' && <Potencial />}
      {ver === 'exigencia' && <Exigencia />}
    </Shell>
  );
}
