/**
 * El sumario estructural, tal como lo arma el motor.
 *
 * Es el respaldo de todo lo que el informe afirma sobre el test de manchas: de
 * estos valores salen las competencias, las lecturas y las recomendaciones. Va
 * en la parte de indicadores, que es la que se archiva.
 *
 * El texto llega con las marcas del motor (`###` para cada bloque, `**` para el
 * rótulo, comillas invertidas para el valor, ``` para las grillas
 * monoespaciadas de localización y calidad formal) y acá se dibuja con
 * elementos, no con HTML crudo: el texto es de cálculo propio, pero incluye
 * nombres de códigos y avisos, y no hay motivo para dejar que algo de ahí se
 * interprete como marcado.
 *
 * **Sin colores.** La hoja de la ficha pinta cada valor según caiga dentro o
 * fuera de su banda, porque ahí se está codificando; acá se está dejando
 * constancia, y lo que importa es que el número se pueda leer y volver a
 * verificar, impreso en blanco y negro incluido.
 */

type Par = { rotulo: string; valor: string; nota: string };
type Bloque = { titulo: string; lineas: Par[][]; grillas: string[]; sueltas: string[] };

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

/** El texto del motor, partido en bloques. */
function bloquesDe(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let actual: Bloque = { titulo: '', lineas: [], grillas: [], sueltas: [] };
  let enGrilla = false;
  let grilla: string[] = [];

  for (const cruda of texto.split('\n')) {
    const linea = cruda.trimEnd();
    if (linea.trim() === '```') {
      if (enGrilla) {
        actual.grillas.push(grilla.join('\n'));
        grilla = [];
      }
      enGrilla = !enGrilla;
      continue;
    }
    if (enGrilla) {
      grilla.push(cruda);
      continue;
    }
    if (linea.startsWith('### ')) {
      if (actual.titulo || actual.lineas.length || actual.grillas.length) bloques.push(actual);
      actual = { titulo: linea.slice(4).trim(), lineas: [], grillas: [], sueltas: [] };
      continue;
    }
    if (!linea.trim() || linea.trim() === '---') continue;
    if (linea.startsWith('>')) {
      actual.sueltas.push(linea.replace(/^>\s*[-]?\s*/, ''));
      continue;
    }
    const ps = pares(linea);
    if (ps.length > 0) actual.lineas.push(ps);
    else actual.sueltas.push(linea.replace(/[`*]/g, ''));
  }
  if (actual.titulo || actual.lineas.length || actual.grillas.length) bloques.push(actual);
  return bloques;
}

export default function Hoja({ texto }: { texto: string }) {
  const bloques = bloquesDe(texto);
  if (bloques.length === 0) return null;

  return (
    <div className="inf-hoja">
      {bloques.map((b, i) => (
        <section key={i} className="inf-hoja-bloque">
          {b.titulo && <h4>{b.titulo}</h4>}
          {b.grillas.map((g, j) => (
            <pre key={j} className="inf-hoja-grilla">
              {g}
            </pre>
          ))}
          {b.lineas.length > 0 && (
            <div className="inf-hoja-campos">
              {b.lineas.flatMap((linea, j) =>
                linea.map((p, k) => (
                  <span key={`${j}-${k}`} className="inf-hoja-par">
                    <span className="inf-hoja-rotulo">{p.rotulo}</span>
                    <span className="inf-hoja-valor">{p.valor || '—'}</span>
                    {p.nota && <span className="inf-hoja-nota">{p.nota}</span>}
                  </span>
                ))
              )}
            </div>
          )}
          {b.sueltas.length > 0 && (
            <ul className="inf-hoja-sueltas">
              {b.sueltas.map((s, j) => (
                <li key={j}>{s}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
