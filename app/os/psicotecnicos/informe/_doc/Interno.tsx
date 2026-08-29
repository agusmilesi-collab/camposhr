import type { Informe } from '@/lib/informe';

/**
 * Lo que solo mira el equipo, no el cliente.
 *
 * Son dos cosas: qué falta cargar para que el informe salga completo, y de
 * dónde sale cada puntaje. Van juntas acá porque las dos se dibujan en la
 * ficha, alrededor del informe que el cliente va a leer, y ninguna de las dos
 * se imprime.
 */

/**
 * Lo que falta cargar, en rojo.
 *
 * Estaba en ámbar, que en el informe es el color de lo que se lee con reparos.
 * Esto no se lee: es un informe al que le faltan datos, y el ámbar lo hacía
 * pasar por una advertencia más de las que el documento ya tiene.
 */
export function Faltantes({ inf }: { inf: Informe }) {
  if (inf.faltantes.length === 0) return null;
  return (
    <aside className="inf-pendientes">
      <strong>Falta cargar para que el informe salga completo:</strong>
      <ul>
        {inf.faltantes.map((f) => (
          <li key={f.que}>
            {f.que}, en {f.donde}.
          </li>
        ))}
      </ul>
      <span className="inf-pendientes-nota">Este aviso no se imprime.</span>
    </aside>
  );
}

/**
 * De dónde sale cada puntaje.
 *
 * Está para revisar contra casos reales las dos cosas que se decidieron acá y
 * no salen de las hojas de la psicóloga: dónde corta cada indicador entre bajo,
 * medio y alto, y cuánto pesa dentro de su competencia.
 */
export function Desglose({
  inf,
  suelto = false,
}: {
  inf: Informe;
  /**
   * Sin su propio desplegable, para cuando ya va adentro de otro.
   *
   * En la ficha vive dentro del desplegable de los indicadores, que se llama
   * igual: dos desplegables anidados con el mismo nombre son uno que hay que
   * abrir dos veces.
   */
  suelto?: boolean;
}) {
  if (!inf.competencias.some((c) => c.renglones.length > 1)) return null;
  const Marco = suelto ? 'div' : 'details';
  return (
<Marco className="inf-desglose">
    {!suelto && <summary>Cómo se calculó cada competencia</summary>}
    {suelto && <h3 className="inf-subtitulo">Cómo se calculó cada competencia</h3>}
    {/* En tabla y no en lista: es lo que la evaluadora mira cuando el
        cliente pregunta de dónde sale un puntaje, así que los índices del
        protocolo tienen que caer siempre en el mismo lugar del renglón. */}
    {inf.competencias.map((c) => (
      <div key={c.nombre} className="inf-desglose-comp">
        <h4>
          {c.nombre}
          <span>
            {c.puntaje === null ? 'sin puntaje' : `${c.puntaje} de 100`}
            {c.referencia && ` · ${c.referencia}`}
          </span>
        </h4>
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Del protocolo</th>
              <th>Nivel</th>
              <th>Peso</th>
              <th>Dónde corta</th>
            </tr>
          </thead>
          <tbody>
            {c.renglones.map((r) => {
              // El Raven no escalona: lo que trae del protocolo es su
              // percentil, y esa es la columna donde hay que buscarlo.
              const nivel =
                r.nivel === null
                  ? r.valor
                    ? '—'
                    : 'sin dato'
                  : ['bajo', 'medio', 'alto'][r.nivel - 1];
              return (
                <tr key={r.indicador}>
                  <td>
                    <b>{r.indicador}</b>
                    <em>{r.mide}</em>
                  </td>
                  <td className="inf-desglose-datos">{r.datos ?? r.valor ?? '—'}</td>
                  <td className="inf-desglose-nivel" data-nivel={r.nivel ?? 'falta'}>
                    {nivel}
                  </td>
                  <td className="inf-desglose-peso">{r.peso === 1 ? '' : `×${r.peso}`}</td>
                  <td className="inf-desglose-corte">{r.corte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ))}
    <span className="inf-pendientes-nota">Tampoco se imprime.</span>
  </Marco>
  );
}
