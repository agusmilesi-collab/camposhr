/**
 * Muestra el sumario tal como lo arma el motor.
 *
 * El motor devuelve el texto con las marcas del editor de Airtable (`**` para
 * el rótulo, comillas invertidas para el valor, `###` para cada bloque). Acá se
 * interpretan esas marcas en vez de reescribir el formateo: el orden de las
 * líneas y las abreviaturas son los de la hoja de sumario, y esa es la forma en
 * que las evaluadoras leen el resultado.
 *
 * Se arma con elementos, no con HTML crudo: el texto sale de un cálculo propio,
 * pero incluye nombres de códigos y avisos, y no hay motivo para abrirle la
 * puerta a que algo de ahí se interprete como marcado.
 */

function Linea({ texto }: { texto: string }) {
  // **rótulo** y `valor` alternados dentro de la misma línea.
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <p className="os-sumario-linea">
      {partes.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <span key={i} className="os-sumario-rotulo">
              {p.slice(2, -2)}
            </span>
          );
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <span key={i} className="os-sumario-valor">
              {p.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export default function SumarioTexto({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  const salida: React.ReactNode[] = [];

  let bloque: string[] | null = null; // dentro de ``` ```

  lineas.forEach((l, i) => {
    if (l.trim() === '```') {
      if (bloque) {
        salida.push(
          <pre key={`b${i}`} className="os-sumario-grilla">
            {bloque.join('\n')}
          </pre>
        );
        bloque = null;
      } else {
        bloque = [];
      }
      return;
    }
    if (bloque) {
      bloque.push(l);
      return;
    }
    if (l.startsWith('### ')) {
      salida.push(
        <h3 key={i} className="os-sumario-titulo">
          {l.slice(4)}
        </h3>
      );
      return;
    }
    if (l.startsWith('> ')) {
      salida.push(
        <div key={i} className="os-sumario-aviso">
          <Linea texto={l.slice(2).replace(/^- /, '')} />
        </div>
      );
      return;
    }
    if (l.startsWith('- ')) {
      salida.push(
        <div key={i} className="os-sumario-item">
          <Linea texto={l.slice(2)} />
        </div>
      );
      return;
    }
    if (l.trim() === '') return;
    salida.push(<Linea key={i} texto={l} />);
  });

  return <div className="os-sumario">{salida}</div>;
}
