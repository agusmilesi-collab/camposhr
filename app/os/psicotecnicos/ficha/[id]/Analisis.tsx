import type { Informe } from '@/lib/informe';
import './analisis.css';

/**
 * Fortalezas y debilidades de la persona, en dos columnas, con la regla de cada una.
 *
 * Es de quien evalúa y no sale al cliente. Cada renglón es una lectura del
 * protocolo tal como la dispara el diccionario: qué índice, qué valor dio, qué
 * se espera en ese test y para qué lado se salió. No hay nada interpretado:
 * si la regla cambia en Configuración, cambia acá.
 *
 * Fortalezas son las lecturas que el informe pone en "Desarrollo destacado" y
 * debilidades las de "Necesidad de desarrollo" (`senalDe`). Lo que está dentro
 * de lo esperado no va en ninguna de las dos.
 */
export default function Analisis({ inf }: { inf: Informe }) {
  const test = inf.proyectivo ?? 'test de manchas';
  const fortalezas = inf.analizadas.filter((a) => a.senal === 'destacada');
  const debilidades = inf.analizadas.filter((a) => a.senal === 'desarrollar');

  if (!inf.analizadas.length) {
    return (
      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-vacio">
            Todavía no hay sumario calculado: el análisis sale de la codificación del {test}.
          </p>
        </div>
      </section>
    );
  }

  const Columna = ({
    titulo,
    items,
    tono,
  }: {
    titulo: string;
    items: Informe['analizadas'];
    tono: 'fuerte' | 'debil';
  }) => (
    <section className={`os-panel os-fd-col os-fd-${tono}`}>
      <div className="os-panel-top">
        <h2>
          {titulo} <span className="os-pestana-cuenta">{items.length}</span>
        </h2>
      </div>
      <div className="os-panel-cuerpo">
        {items.length === 0 ? (
          <p className="os-vacio">Ninguna lectura del protocolo cae acá.</p>
        ) : (
          <ul className="os-fd-lista">
            {items.map((a) => (
              <li key={a.clave} className="os-fd-item">
                <p className="os-fd-regla">
                  {/* Algunos valores vienen sin el índice adelante ("0,28"). */}
                  <strong>{/^[\d+−-]/.test(a.valor) ? `${a.indice} ${a.valor}` : a.valor}</strong>
                  {a.esperado && <> · esperado {a.esperado}</>}
                  {a.lado && (
                    <>
                      {' '}
                      → <span className="os-fd-lado">{a.lado}</span>
                    </>
                  )}
                </p>
                <p className="os-fd-dice">{a.dice}</p>
                <p className="os-fd-fuente">
                  {test} · {a.area} · índice {a.indice}
                  {a.regla && <> · entra con {a.regla}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  return (
    <div className="os-fd">
      <Columna titulo="Fortalezas" items={fortalezas} tono="fuerte" />
      <Columna titulo="Debilidades" items={debilidades} tono="debil" />
    </div>
  );
}
