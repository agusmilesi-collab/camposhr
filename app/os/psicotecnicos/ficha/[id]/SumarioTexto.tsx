/**
 * El sumario con la disposición de la hoja de cálculos numéricos.
 *
 * Los siete bloques van donde están en la hoja que la evaluadora tiene sobre
 * el escritorio: Controles, Afectos e Interpersonal arriba; Ideación,
 * Mediación, Procesamiento y Autopercepción abajo; las constelaciones al pie,
 * en fila. Buscar un dato es mirar el mismo lugar en la pantalla y en el papel.
 *
 * Dentro de cada bloque los campos caen en una grilla de celdas iguales, con
 * el valor pegado a su rótulo: primero qué es, después cuánto dio. Un campo de
 * rótulo largo o con la cuenta a la vista se queda con el renglón entero, que
 * es lo que necesita para no partirse.
 *
 * Cada línea del motor arranca en la primera columna. El motor agrupa los
 * campos que se leen juntos, EB con EA, o eb con es, y ese agrupamiento es
 * parte del dato: una grilla que los corriera para llenar huecos los mezclaría
 * con los de la línea siguiente.
 *
 * El motor también manda la línea punteada de la hoja, que en Controles separa
 * el desglose de eb. Lo que viene después del corte va en tres columnas y se
 * llena hacia abajo, como está impreso: FM sobre m, C' sobre V, T sobre Y.
 *
 * El cierre son dos tarjetas del mismo tamaño: las constelaciones, con el
 * detalle de las que dieron positivo adentro, y los códigos especiales. El
 * detalle es la explicación de un puntaje y va con él, no en otra tarjeta. El
 * Zulliger no tiene constelaciones: ahí queda una sola tarjeta, que conserva
 * su media hoja en vez de estirarse, para que los dos niveles de los códigos
 * sigan cayendo uno al lado del otro.
 *
 * Lo que se dibuja sale entero del texto que arma el motor, con sus marcas
 * (`**` para el rótulo, comillas invertidas para el valor, `###` para cada
 * bloque). Un bloque nuevo que el motor empiece a emitir aparece igual, en la
 * tarjeta de las constelaciones: esta vista no descarta nada de lo que mande.
 *
 * Se arma con elementos, no con HTML crudo: el texto sale de un cálculo
 * propio, pero incluye nombres de códigos y avisos, y no hay motivo para
 * abrirle la puerta a que algo de ahí se interprete como marcado.
 *
 * Los indicadores con banda fija van con el fondo pintado: verde mientras el
 * valor cae dentro de lo esperado y rojo cuando lo cruza. La banda sale de los
 * mismos cortes con los que el motor elige las lecturas del informe
 * (`bandasDeLaHoja`), así que la hoja y el informe no pueden decir cosas
 * distintas, y moverla se hace desde Sistema → Redacciones. Afr se pinta con la
 * banda de su estilo, que la pasa la ficha: lo que se espera de la proporción
 * afectiva cambia según la persona sea introversiva, ambigual o extratensiva.
 * Los que entran contra la cantidad de respuestas (Zf, P) quedan sin pintar: ahí
 * el rótulo solo no alcanza para saber qué se espera.
 */

import type { Banda } from '@/lib/redacciones';

/** Dónde cae cada bloque de la hoja, por fila. */
const HOJA = [
  ['Controles', 'Afectos', 'Interpersonal'],
  ['Ideación', 'Mediación', 'Procesamiento', 'Autopercepción'],
];

const CONSTELACIONES = 'Constelaciones';
const CODIGOS = 'Códigos especiales';

/**
 * Lo que el motor calcula y la hoja no muestra.
 *
 * "No aplica en Zulliger" es la lista de lo que ese test no tiene y por qué.
 * La evaluadora ya lo sabe, así que en pantalla sería ruido. Sigue en el texto
 * guardado, que es lo que después lee el agente que redacta el informe.
 */
const OCULTOS = (titulo: string) => titulo.startsWith('No aplica');

type Par = { rotulo: string; valor: string; nota: string };

/** Si el valor de ese par cae dentro de su banda, la cruza, o no tiene banda. */
type Estado = { clase: string; title: string } | null;

/**
 * El número de un valor de la hoja.
 *
 * Los porcentajes vienen con la cuenta que los produce ("3 / 20 = 0.15") y lo
 * que se compara es el resultado, así que de esos se toma lo que sigue al
 * igual. Lo que no es un número (una razón como "5:3", un "—") no se compara.
 */
function numeroDe(valor: string): number | null {
  const crudo = valor.includes('=') ? valor.slice(valor.lastIndexOf('=') + 1) : valor;
  const limpio = crudo.replace('−', '-').replace(',', '.').trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Cómo se escribe un extremo de la banda: con los decimales de su corte. */
function extremo(v: number, decimales: number): string {
  return v.toFixed(decimales).replace('.', ',');
}

function estadoDe(p: Par, bandas: Record<string, Banda>): Estado {
  const b = bandas[p.rotulo];
  if (!b) return null;
  const v = numeroDe(p.valor);
  if (v === null) return null;
  const dentro = (b.minimo === null || v >= b.minimo) && (b.maximo === null || v <= b.maximo);
  const n = (x: number) => extremo(x, b.decimales);
  const esperado =
    b.minimo !== null && b.maximo !== null
      ? b.minimo === b.maximo
        ? `exactamente ${n(b.minimo)}`
        : `de ${n(b.minimo)} a ${n(b.maximo)}`
      : b.minimo !== null
        ? `${n(b.minimo)} o más`
        : b.maximo === 0
          ? 'en cero'
          : `hasta ${n(b.maximo as number)}`;
  return {
    clase: dentro ? 'os-hoja-dentro' : 'os-hoja-fuera',
    title: `${b.indice} esperado: ${esperado}`,
  };
}
/** Una línea del bloque: sus campos, o el corte punteado de la hoja. */
type Linea = { pares: Par[]; corte?: true; tercios?: true };
type Bloque = { titulo: string; lineas: Linea[]; sueltas: string[] };

/** La marca con la que el motor pide la línea punteada. */
const CORTE = '---';

/** Los pares `**rótulo** \`valor\`` de una línea, con lo que quede al lado. */
function pares(linea: string): Par[] {
  return linea
    .split(' | ')
    .map((p) => {
      const m = p.match(/^\*\*([^*]+)\*\*\s*`([^`]*)`\s*(.*)$/);
      return m ? { rotulo: m[1], valor: m[2], nota: m[3].trim() } : null;
    })
    .filter((p): p is Par => p !== null);
}

/** Un campo que no entra en media fila: se queda con el renglón entero. */
function esAncho(p: Par): boolean {
  return p.rotulo.length > 9 || p.valor.includes('=') || Boolean(p.nota);
}

/** El valor de un par, con el fondo pintado si su índice tiene banda. */
function Valor({ p, bandas }: { p: Par; bandas: Record<string, Banda> }) {
  const e = estadoDe(p, bandas);
  return (
    <span className={`os-hoja-valor${e ? ` ${e.clase}` : ''}`} title={e?.title}>
      {p.valor || '—'}
    </span>
  );
}

function Bloque({ b, bandas }: { b: Bloque; bandas: Record<string, Banda> }) {
  return (
    <section className="os-hoja-bloque">
      <h3 className="os-hoja-titulo">{b.titulo}</h3>
      <div className="os-hoja-campos">
        {b.lineas.map((linea, i) => {
          if (linea.corte) return <hr key={i} className="os-hoja-corte" />;
          if (linea.tercios) {
            return (
              <div key={i} className="os-hoja-tercios">
                {linea.pares.map((p, j) => (
                  <div key={j} className="os-hoja-par">
                    <span className="os-hoja-rotulo">{p.rotulo}</span>
                    <Valor p={p} bandas={bandas} />
                  </div>
                ))}
              </div>
            );
          }
          return linea.pares.map((p, j) => (
            <div
              key={`${i}-${j}`}
              className={[
                'os-hoja-par',
                esAncho(p) ? 'os-hoja-par-ancho' : '',
                j === 0 ? 'os-hoja-par-inicio' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="os-hoja-rotulo">{p.rotulo}</span>
              <Valor p={p} bandas={bandas} />
              {p.nota && <span className="os-hoja-nota">{p.nota}</span>}
            </div>
          ));
        })}
      </div>
      {b.sueltas.length > 0 && (
        <ul className="os-hoja-sueltas">
          {b.sueltas.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Las seis constelaciones y, abajo, el detalle de las que dieron positivo.
 *
 * Van juntas porque el detalle es la cuenta de ese puntaje: leer "CDI 4/5" y
 * después buscar en otra tarjeta cuáles cuatro condiciones se cumplieron es
 * partir un dato en dos.
 */
function Constelaciones({ b, detalles }: { b: Bloque; detalles: Bloque[] }) {
  return (
    <section className="os-hoja-bloque">
      <h3 className="os-hoja-titulo">{b.titulo}</h3>
      <div className="os-hoja-constelaciones">
        {b.lineas.flatMap((l) => l.pares).map((p, i) => {
          const positiva = /POSITIVO/i.test(p.nota);
          return (
            <div key={i} className={`os-hoja-indice${positiva ? ' positiva' : ''}`}>
              <div className="os-hoja-rotulo">{p.rotulo}</div>
              <div className="os-hoja-numero">{p.valor || '—'}</div>
              <div className="os-hoja-nota">{p.nota.replace(/^—\s*/, '')}</div>
            </div>
          );
        })}
      </div>

      {detalles.map((d) => (
        <div key={d.titulo} className="os-hoja-detalle">
          <h4 className="os-hoja-subtitulo">{d.titulo}</h4>
          <ul className="os-hoja-sueltas">
            {d.sueltas.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default function SumarioTexto({
  texto,
  bandas,
}: {
  texto: string;
  /** La banda esperada de cada índice, por rótulo de la hoja. Ver `bandasDeLaHoja`. */
  bandas: Record<string, Banda>;
}) {
  const bloques: Bloque[] = [];
  const encabezado: Par[][] = [];

  let actual: Bloque | null = null;
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (l === '' || l === '```') continue;

    if (l.startsWith('### ')) {
      actual = { titulo: l.slice(4), lineas: [], sueltas: [] };
      bloques.push(actual);
      continue;
    }

    if (l === CORTE) {
      if (actual) actual.lineas.push({ pares: [], corte: true });
      continue;
    }

    const limpia = l.replace(/^[>-]\s*/, '');
    const p = pares(limpia);
    if (!actual) {
      if (p.length > 0) encabezado.push(p);
      continue;
    }
    if (p.length > 0) {
      // Lo que sigue al corte es el desglose, que va en tres columnas.
      const previa = actual.lineas[actual.lineas.length - 1];
      actual.lineas.push({ pares: p, ...(previa?.corte ? { tercios: true as const } : {}) });
    } else {
      actual.sueltas.push(limpia);
    }
  }

  const porTitulo = new Map(bloques.map((b) => [b.titulo, b]));
  const enLaHoja = new Set([...HOJA.flat(), CONSTELACIONES, CODIGOS]);
  const constelaciones = porTitulo.get(CONSTELACIONES);
  const codigos = porTitulo.get(CODIGOS);
  // Lo que queda es el detalle de las constelaciones que dieron positivo.
  const detalles = bloques.filter((b) => !enLaHoja.has(b.titulo) && !OCULTOS(b.titulo));

  return (
    <div className="os-hoja">
      {encabezado.length > 0 && (
        <div className="os-hoja-encabezado">
          {encabezado.flat().map((p, i) => (
            <span key={i} className="os-hoja-par">
              <span className="os-hoja-rotulo">{p.rotulo}</span>
              <span className="os-hoja-valor">{p.valor}</span>
            </span>
          ))}
        </div>
      )}

      {HOJA.map((fila, i) => (
        <div
          key={i}
          className="os-hoja-fila"
          style={{ '--os-hoja-columnas': fila.length } as React.CSSProperties}
        >
          {fila.map((titulo) => {
            const b = porTitulo.get(titulo);
            return b ? <Bloque key={titulo} b={b} bandas={bandas} /> : null;
          })}
        </div>
      ))}

      {(constelaciones || codigos || detalles.length > 0) && (
        <div className="os-hoja-cierre">
          {constelaciones ? (
            <Constelaciones b={constelaciones} detalles={detalles} />
          ) : (
            // Sin constelaciones, un bloque suelto se sostiene por su cuenta.
            detalles.map((b) => <Bloque key={b.titulo} b={b} bandas={bandas} />)
          )}
          {codigos && <Bloque b={codigos} bandas={bandas} />}
        </div>
      )}
    </div>
  );
}
