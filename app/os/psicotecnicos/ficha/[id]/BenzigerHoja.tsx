/**
 * El Benziger leído, con la disposición de su hoja.
 *
 * El perfil arriba, como la tabla del informe: cada fila con sus cuatro
 * cuadrantes, con un punto azul en el más alto y uno rojo en el más bajo.
 * Debajo las cruces, dibujadas en cruz de verdad, con Frontal arriba y Basal
 * abajo, y el cuadrante entero pintado: en una cruz chica el color se ve de
 * lejos y la diagonal salta sin leer un solo número.
 *
 * Después el estilo que da la alerta, el estado emocional, lo que la persona
 * escribió y los acontecimientos del último año.
 */

import type { Lectura } from '@/lib/benziger-lectura';
import type { Cruz, Cuatro } from '@/lib/benziger-perfil';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';

function marca(valores: Cuatro, p: Perfil): '' | 'alto' | 'bajo' {
  const vals = PERFILES.map((x) => valores[x]);
  if (vals.some((x) => x === null)) return '';
  const numeros = vals as number[];
  if (valores[p] === Math.max(...numeros)) return 'alto';
  if (valores[p] === Math.min(...numeros)) return 'bajo';
  return '';
}

/** El punto que marca el cuadrante: azul el más alto, rojo el más bajo. */
function Punto({ m }: { m: '' | 'alto' | 'bajo' }) {
  if (!m) return null;
  return (
    <span
      className={`os-bz-punto ${m}`}
      aria-label={m === 'alto' ? 'el más alto' : 'el más bajo'}
    />
  );
}

/** La tabla del perfil: una fila por medición, cuatro cuadrantes cada una. */
function Perfil({ filas }: { filas: Lectura['filas'] }) {
  return (
    <table className="os-bz-tabla">
      <thead>
        <tr>
          <th />
          {PERFILES.map((p) => (
            <th key={p} title={INFO[p].nombre}>
              {p}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr
            key={f.titulo}
            className={
              f.titulo === 'Total adulto'
                ? 'os-bz-total'
                : f.titulo === 'Total joven'
                  ? 'os-bz-total os-bz-aparte'
                  : undefined
            }
          >
            <th scope="row">{f.titulo}</th>
            {PERFILES.map((p) => {
              const m = marca(f.valores, p);
              return (
                <td key={p} className="os-bz-celda">
                  <span className="os-bz-valor">{f.valores[p] ?? '—'}</span>
                  <Punto m={m} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Dónde corta cada zona de la escala de alerta. */
const ZONAS = [
  { texto: 'Extravertido', desde: 12, hasta: 8 },
  { texto: 'Equilibrado', desde: 7, hasta: 5 },
  { texto: 'Introvertido', desde: 4, hasta: 0 },
];

/**
 * La escala de alerta, de 12 a 0, con el valor marcado.
 *
 * El número solo no dice dónde cae. La escala lo ubica, y los cortes entre
 * zonas muestran a qué distancia está de cambiar de categoría: un 8 y un 12
 * son los dos extravertidos, pero uno está en el borde.
 */
function Escala({ nivel }: { nivel: number | null }) {
  if (nivel === null) return null;
  return (
    <div className="os-bz-escala">
      <div className="os-bz-pasos">
        {Array.from({ length: 13 }, (_, i) => 12 - i).map((n) => (
          <span
            key={n}
            className={`os-bz-paso${n === nivel ? ' aca' : ''}${
              n === 8 || n === 5 ? ' corte' : ''
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="os-bz-zonas">
        {ZONAS.map((z) => (
          <span
            key={z.texto}
            className={`os-bz-zona${nivel <= z.desde && nivel >= z.hasta ? ' aca' : ''}`}
            style={{ gridColumn: `span ${z.desde - z.hasta + 1}` }}
          >
            {z.texto}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Una cruz: Frontal arriba, Basal abajo, con su lectura al pie. */
function CruzVista({ c }: { c: Cruz }) {
  return (
    <div className="os-bz-cruz">
      <h4 className="os-hoja-subtitulo">{c.titulo}</h4>
      <div className="os-bz-cuadrantes">
        {(['FI', 'FD', 'BI', 'BD'] as Perfil[]).map((p) => (
          <div key={p} className={`os-bz-cuadrante ${marca(c.valores, p)}`}>
            <span className="os-bz-sigla">{p}</span>
            <span className="os-bz-numero">{c.valores[p] ?? '—'}</span>
          </div>
        ))}
      </div>
      <p className={`os-bz-lectura ${c.lectura}`}>{c.texto}</p>
    </div>
  );
}

export default function BenzigerHoja({ l }: { l: Lectura }) {
  const { alerta, emocional, estres } = l;

  return (
    <div className="os-hoja os-bz-hoja">
      {/* Perfil y cruces arriba: son la misma lectura, los números y su
          dibujo. Todo lo demás va debajo. */}
      <div className="os-hoja-fila" style={{ '--os-hoja-columnas': 2 } as React.CSSProperties}>
        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Perfil</h3>
          <Perfil filas={l.filas} />
          {!l.tiempoLibre.cuenta && (
            <p className="os-hoja-nota-tl">
              El tiempo libre no entra en la lectura: la persona no lo pasa haciendo lo que quiere
              {l.tiempoLibre.respuesta ? `, sino "${l.tiempoLibre.respuesta}"` : ''}.
            </p>
          )}
        </section>

        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Cruces</h3>
          <div className="os-bz-cruces">
            {l.cruces.map((c) => (
              <CruzVista key={c.titulo} c={c} />
            ))}
          </div>
        </section>
      </div>

      <div className="os-hoja-fila" style={{ '--os-hoja-columnas': 3 } as React.CSSProperties}>
        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Estilo y estrés</h3>
          {[
            { rotulo: 'Adulto', nivel: alerta.adulto, estilo: alerta.estiloAdulto },
            { rotulo: 'Joven', nivel: alerta.joven, estilo: alerta.estiloJoven },
          ].map((a) => (
            <div key={a.rotulo} className="os-bz-alerta">
              <div className="os-hoja-par">
                <span className="os-hoja-rotulo">{a.rotulo}</span>
                <span className="os-hoja-valor">{a.nivel ?? '—'}</span>
                <span className="os-hoja-nota">{a.estilo ?? 'sin definir'}</span>
              </div>
              <Escala nivel={a.nivel} />
            </div>
          ))}

          <div className="os-hoja-detalle">
            <div className="os-hoja-par">
              <span className="os-hoja-rotulo">Puntos de estrés</span>
              <span className="os-hoja-valor">{estres.puntos ?? '—'}</span>
            </div>
          </div>
        </section>

        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Estado emocional</h3>
          <table className="os-bz-tabla">
            <thead>
              <tr>
                <th />
                <th>POS</th>
                <th>DET</th>
                <th>NEG</th>
              </tr>
            </thead>
            <tbody>
              {[
                { rotulo: '3 años', d: emocional.q56 },
                { rotulo: '3 meses', d: emocional.q57 },
                { rotulo: 'Total', d: emocional.total },
              ].map(({ rotulo, d }) => (
                <tr key={rotulo}>
                  <th scope="row">{rotulo}</th>
                  <td className="os-bz-celda">
                    <span className="os-bz-valor">{d.pos ?? '—'}</span>
                  </td>
                  <td className="os-bz-celda">
                    <span className="os-bz-valor">{d.det ?? '—'}</span>
                  </td>
                  <td className="os-bz-celda">
                    <span className="os-bz-valor">{d.neg ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {[
            { rotulo: 'Últimos 3 años', d: emocional.q56 },
            { rotulo: 'Últimos 3 meses', d: emocional.q57 },
          ].map(({ rotulo, d }) => (
            <div key={rotulo} className="os-hoja-detalle">
              <h4 className="os-hoja-subtitulo">
                {rotulo}
                {d.ponderado ? ` · ${d.ponderado}` : ''}
              </h4>
              {d.adjetivos && <p className="os-bz-texto">{d.adjetivos}</p>}
            </div>
          ))}
        </section>

        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Autoimagen</h3>
          <div className="os-hoja-campos">
            <div className="os-hoja-par os-hoja-par-ancho">
              <span className="os-hoja-rotulo">Imagen</span>
              <span className="os-hoja-valor">{l.autoimagen.imagen ?? '—'}</span>
            </div>
          </div>
          {l.autoimagen.adjetivo && (
            <div className="os-hoja-detalle">
              <h4 className="os-hoja-subtitulo">Adjetivo</h4>
              <p className="os-bz-texto">{l.autoimagen.adjetivo}</p>
            </div>
          )}
        </section>
      </div>

      {/* Lo que la persona escribió y lo que le pasó, uno al lado del otro:
          las dos cosas se leen juntas para entender el momento en que llega. */}
      <div
        className="os-hoja-fila os-bz-cierre"
        style={{ '--os-hoja-columnas': 2 } as React.CSSProperties}
      >
        {l.abiertas.length > 0 && (
          <section className="os-hoja-bloque">
            <h3 className="os-hoja-titulo">Lo que escribió</h3>
            {l.abiertas.map((a) => (
              <div key={a.rotulo} className="os-hoja-detalle">
                <h4 className="os-hoja-subtitulo">{a.rotulo}</h4>
                <p className="os-bz-texto">{a.texto}</p>
              </div>
            ))}
          </section>
        )}

        <section className="os-hoja-bloque">
          <h3 className="os-hoja-titulo">Acontecimientos del último año</h3>
          {estres.eventos.length > 0 ? (
            <ul className="os-hoja-sueltas">
              {estres.eventos.map((e) => (
                <li key={e.texto}>
                  {e.texto} · {e.veces}
                </li>
              ))}
            </ul>
          ) : (
            <p className="os-hoja-nota-tl">Ninguno registrado.</p>
          )}
        </section>
      </div>
    </div>
  );
}
