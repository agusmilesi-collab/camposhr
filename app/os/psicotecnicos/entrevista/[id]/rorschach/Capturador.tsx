'use client';

/**
 * La codificación del Rorschach mientras se toma, con la lámina a la vista.
 *
 * Se abre en la encuesta, no en la asociación libre: dónde vio la persona lo
 * que vio se establece recién ahí. Primero se escribe lo que dijo, después se
 * marca dónde, y con esas dos cosas la Tabla A dice la calidad formal.
 *
 * Se llega al área por dos caminos, porque la mitad de las veces la persona
 * describe con palabras en vez de señalar:
 *
 *   · Apretando el área en la lámina, que deja la lista de esa área a la vista.
 *   · Buscando la palabra en toda la lámina, que devuelve en qué áreas existe
 *     esa respuesta y con qué calidad en cada una. "Cara humana" está en seis
 *     áreas de la lámina I y no vale lo mismo en ninguna: esa es la decisión
 *     que hoy se toma hojeando el librito.
 *
 * Lo que se captura acá llega a la ficha como borrador, con los cinco campos
 * que el sistema no puede saber marcados como pendientes. Si no se usa esta
 * pantalla, la ficha queda vacía y se carga a mano, como siempre.
 *
 * Las respuestas que no están en la tabla se guardan igual, marcadas como
 * extrapoladas: pasa seguido, y forzarlas a la palabra más parecida del índice
 * sería codificar sobre el índice en vez de sobre lo que dijo la persona.
 */

import { useMemo, useState } from 'react';
import { AREAS, type Parte } from '@/lib/rorschach-areas';
import { LAMINAS, areasDe, buscar, entradasDe, esPopular, type Hallazgo } from '@/lib/rorschach-tabla-a';
import { PENDIENTES, contenidoSugerido, fqDeLaFicha, localizacionesDe } from '@/lib/rorschach-sugerencias';

const LAMINA = 'I';

/** Con qué capa se mira el mapa. Todas juntas no se leen: se pisan entre ellas. */
const CAPAS = {
  D: { rotulo: 'D', de: (a: string) => /^D\d/.test(a) || a === 'W' },
  Dd: { rotulo: 'Dd', de: (a: string) => /^Dd\d/.test(a) },
  S: { rotulo: 'Espacios', de: (a: string) => a.includes('S') },
} as const;
type Capa = keyof typeof CAPAS;

type Respuesta = {
  n: number;
  dijo: string;
  area: string;
  entrada: Hallazgo | null;
  /** Sin entrada en la tabla: la calidad la pone la evaluadora. */
  extrapolada: boolean;
  fq: string | null;
  localizacion: string | null;
  contenidos: string[];
  popular: boolean;
  z: number | null;
  observacion: string;
};

function camino(parte: Parte): string {
  return parte.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' ') + 'Z';
}

export default function Capturador({
  evaluacionId,
  nombre,
}: {
  evaluacionId: string;
  nombre: string;
}) {
  const [capa, setCapa] = useState<Capa>('D');
  const [area, setArea] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [dijo, setDijo] = useState('');
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = useMemo(
    () => areasDe(LAMINA).filter((a) => CAPAS[capa].de(a)),
    [capa]
  );

  /** Lo que se ofrece elegir: la lista del área, o la búsqueda en toda la lámina. */
  const opciones: Hallazgo[] = useMemo(() => {
    if (texto.trim().length >= 2) return buscar(LAMINA, texto).slice(0, 40);
    if (area) return entradasDe(LAMINA, area);
    return [];
  }, [texto, area]);

  function tomar(h: Hallazgo | null) {
    const n = respuestas.length + 1;
    const suArea = h?.area ?? area;
    if (!suArea) return;
    const respuesta = h?.respuesta ?? dijo.trim() ?? '';
    const locs = localizacionesDe(suArea);
    setRespuestas((rs) => [
      ...rs,
      {
        n,
        dijo: dijo.trim() || respuesta,
        area: suArea,
        entrada: h,
        extrapolada: !h,
        fq: h ? fqDeLaFicha(h.calidad) : null,
        // Si el área admite una sola localización no hay nada que elegir; si
        // admite varias, la calidad evolutiva la pone la evaluadora.
        localizacion: locs.length === 1 ? locs[0] : null,
        contenidos: contenidoSugerido(respuesta),
        popular: esPopular(LAMINA, suArea, respuesta),
        z: suArea === 'W' ? LAMINAS[LAMINA].z.ZW : null,
        observacion: '',
      },
    ]);
    setTexto('');
    setDijo('');
    setArea(null);
  }

  function cambiar(n: number, campos: Partial<Respuesta>) {
    setRespuestas((rs) => rs.map((r) => (r.n === n ? { ...r, ...campos } : r)));
  }

  function faltan(r: Respuesta): string[] {
    const f: string[] = [];
    if (!r.localizacion) f.push('Loc. + DQ');
    if (!r.fq) f.push('FQ');
    if (r.contenidos.length === 0) f.push('Contenidos');
    f.push('Determinantes');
    return f;
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    let mal = 0;
    for (const r of respuestas) {
      const res = await fetch('/api/os/manchas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacionId,
          campos: {
            lamina: LAMINA,
            n_respuesta: r.n,
            n_localizacion: r.area,
            localizacion: r.localizacion,
            fq: r.fq,
            contenidos: r.contenidos,
            popular: r.popular,
            z: r.z,
            determinantes: [],
            cc_ee: [],
            par: false,
            agc: false,
            sl: false,
          },
        }),
      });
      if (!res.ok) mal++;
    }
    setGuardando(false);
    setAviso(
      mal === 0
        ? `Se pasaron ${respuestas.length} respuestas a la ficha de ${nombre}. Los determinantes y lo demás se completan ahí.`
        : `Quedaron ${mal} respuestas sin pasar. Miralo antes de seguir.`
    );
  }

  const pendientes = respuestas.reduce((s, r) => s + faltan(r).length, 0);

  return (
    <div className="os-ror">
      <div className="os-ror-arriba">
        {/* ---------------------------------------------------------- el mapa */}
        <section className="os-panel os-ror-mapa">
          <div className="os-ror-capas">
            {(Object.keys(CAPAS) as Capa[]).map((c) => (
              <button
                key={c}
                type="button"
                className={`os-boton${capa === c ? ' os-boton-firme' : ''}`}
                onClick={() => setCapa(c)}
              >
                {CAPAS[c].rotulo}
              </button>
            ))}
          </div>

          <div className="os-ror-lienzo">
            <img src={`/api/os/lamina/rorschach/1`} alt="Lámina I" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {visibles.map((a) =>
                (AREAS[a] ?? []).map((parte, i) => (
                  <path
                    key={`${a}-${i}`}
                    d={camino(parte)}
                    className={
                      'os-ror-area' +
                      (area === a ? ' os-ror-area-puesta' : '') +
                      (encima === a ? ' os-ror-area-encima' : '')
                    }
                    onMouseEnter={() => setEncima(a)}
                    onMouseLeave={() => setEncima(null)}
                    onClick={() => {
                      setArea(a);
                      setTexto('');
                    }}
                  />
                ))
              )}
            </svg>
          </div>

          <ul className="os-ror-lista-areas">
            {visibles.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  className={`os-ror-chip${area === a ? ' os-ror-chip-puesto' : ''}`}
                  onMouseEnter={() => setEncima(a)}
                  onMouseLeave={() => setEncima(null)}
                  onClick={() => {
                    setArea(a);
                    setTexto('');
                  }}
                >
                  {a}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ la respuesta */}
        <section className="os-panel os-ror-eleccion">
          <label className="os-ror-campo">
            <span className="os-dato-rotulo">Qué dijo</span>
            <input
              className="os-campo"
              value={dijo}
              onChange={(e) => setDijo(e.target.value)}
              placeholder="Sus palabras, textuales"
            />
          </label>

          <label className="os-ror-campo">
            <span className="os-dato-rotulo">
              Buscar en toda la lámina{area ? ` · o elegir de ${area}` : ''}
            </span>
            <input
              className="os-campo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="murciélago, cara humana, pájaro…"
            />
          </label>

          <div className="os-ror-opciones">
            {opciones.length === 0 && (
              <p className="os-ror-vacio">
                {area
                  ? 'Esa área no tiene entradas para la lámina derecha.'
                  : 'Apretá un área en la lámina, o buscá lo que dijo.'}
              </p>
            )}
            {opciones.map((h, i) => (
              <button
                key={`${h.area}-${h.respuesta}-${i}`}
                type="button"
                className="os-ror-opcion"
                onClick={() => tomar(h)}
              >
                <span className={`os-ror-fq os-ror-fq-${h.calidad === '-' ? 'menos' : h.calidad}`}>
                  {h.calidad}
                </span>
                <span className="os-ror-opcion-texto">{h.respuesta}</span>
                <span className="os-ror-opcion-area">{h.area}</span>
              </button>
            ))}
          </div>

          {(area || dijo.trim()) && (
            <button type="button" className="os-boton" onClick={() => tomar(null)}>
              No está en la tabla: cargar igual{area ? ` en ${area}` : ''}
            </button>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------ lo capturado */}
      <section className="os-panel os-ror-capturadas">
        <div className="os-ror-encabezado">
          <h2>
            {respuestas.length} respuesta{respuestas.length === 1 ? '' : 's'}
          </h2>
          <p className="os-ror-cuenta">
            {pendientes > 0
              ? `${pendientes} campos quedan para completar a mano en la ficha`
              : 'Sin campos obligatorios pendientes acá'}
          </p>
        </div>

        {respuestas.length > 0 && (
          <table className="os-tabla os-ror-tabla">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Qué dijo</th>
                <th>Área</th>
                <th>Loc. + DQ</th>
                <th>FQ</th>
                <th>Contenidos</th>
                <th>P</th>
                <th>Z</th>
                <th>Falta</th>
              </tr>
            </thead>
            <tbody>
              {respuestas.map((r) => (
                <tr key={r.n} className={r.extrapolada ? 'os-ror-extrapolada' : undefined}>
                  <td>{r.n}</td>
                  <td>{r.dijo}</td>
                  <td>{r.area}</td>
                  <td>
                    <select
                      className="os-campo"
                      value={r.localizacion ?? ''}
                      onChange={(e) => cambiar(r.n, { localizacion: e.target.value || null })}
                    >
                      <option value="">a mano</option>
                      {localizacionesDe(r.area).map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{r.fq ?? <span className="os-ror-falta">a mano</span>}</td>
                  <td>{r.contenidos.join(', ') || <span className="os-ror-falta">a mano</span>}</td>
                  <td>{r.popular ? 'P' : ''}</td>
                  <td>{r.z ?? ''}</td>
                  <td className="os-ror-falta">{faltan(r).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="os-ror-pie">
          <p className="os-ror-aclaracion">
            Lo que esta pantalla no puede saber, y se completa en la ficha:{' '}
            {PENDIENTES.filter((p) => p.campo !== 'localizacion')
              .map((p) => p.rotulo)
              .join(', ')}
            .
          </p>
          <button
            type="button"
            className="os-boton-firme"
            disabled={respuestas.length === 0 || guardando}
            onClick={guardar}
          >
            {guardando ? 'Pasando…' : 'Pasar a la ficha'}
          </button>
        </div>
        {aviso && <p className="os-form-ok">{aviso}</p>}
      </section>
    </div>
  );
}
