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
 *     esa respuesta y con qué calidad en cada una. "Cara humana" está en cuatro
 *     áreas de la lámina I y no vale lo mismo en ninguna: esa es la decisión
 *     que hoy se toma hojeando el librito.
 *
 * Se pueden marcar varias áreas para una misma respuesta, que es lo que hace
 * falta para el puntaje Z: integrar dos áreas adyacentes puntúa distinto que
 * integrar dos distantes, y el blanco integrado con la tinta distinto de las
 * dos. La regla vive en `lib/rorschach-z.ts`; acá se muestra qué salió y qué
 * queda por confirmar.
 *
 * Lo que se captura llega a la ficha como borrador, con los campos que el
 * sistema no puede saber marcados como pendientes. Si no se usa esta pantalla,
 * la ficha queda vacía y se carga a mano, como siempre.
 */

import { useMemo, useState } from 'react';
import { AREAS, type Parte } from '@/lib/rorschach-areas';
import { areasDe, buscar, entradasDe, esPopular, type Hallazgo } from '@/lib/rorschach-tabla-a';
import { PENDIENTES, contenidoSugerido, fqDeLaFicha, localizacionesDe } from '@/lib/rorschach-sugerencias';
import { esEspacio, puntajeZ } from '@/lib/rorschach-z';

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
  areas: string[];
  /** Sin entrada en la tabla: la calidad la pone la evaluadora. */
  extrapolada: boolean;
  fq: string | null;
  localizacion: string | null;
  contenidos: string[];
  popular: boolean;
  /** Lo confirma ella: las áreas están integradas con relación significativa. */
  integradas: boolean;
  /** Lo confirma ella: el blanco entra junto con la tinta. */
  blancoIntegrado: boolean;
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
  const [puestas, setPuestas] = useState<string[]>([]);
  const [encima, setEncima] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [dijo, setDijo] = useState('');
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = useMemo(() => areasDe(LAMINA).filter((a) => CAPAS[capa].de(a)), [capa]);

  /** El área de la que se ofrece la lista: la última marcada. */
  const principal = puestas.length > 0 ? puestas[puestas.length - 1] : null;

  const opciones: Hallazgo[] = useMemo(() => {
    if (texto.trim().length >= 2) return buscar(LAMINA, texto).slice(0, 40);
    if (principal) return entradasDe(LAMINA, principal);
    return [];
  }, [texto, principal]);

  function alternar(a: string) {
    setPuestas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
    setTexto('');
  }

  function tomar(h: Hallazgo | null) {
    // Si se eligió del buscador un área que no estaba marcada, esa manda.
    const areas = h && !puestas.includes(h.area) ? [...puestas, h.area] : puestas;
    if (areas.length === 0) return;
    const respuesta = h?.respuesta ?? dijo.trim();
    const locs = localizacionesDe(areas[0]);
    setRespuestas((rs) => [
      ...rs,
      {
        n: rs.length + 1,
        dijo: dijo.trim() || respuesta,
        areas,
        extrapolada: !h,
        fq: h ? fqDeLaFicha(h.calidad) : null,
        // Si el área admite una sola localización no hay nada que elegir; si
        // admite varias, la calidad evolutiva la pone la evaluadora.
        localizacion: locs.length === 1 ? locs[0] : null,
        contenidos: contenidoSugerido(respuesta),
        popular: esPopular(LAMINA, areas[0], respuesta),
        integradas: false,
        blancoIntegrado: false,
      },
    ]);
    setTexto('');
    setDijo('');
    setPuestas([]);
  }

  function cambiar(n: number, campos: Partial<Respuesta>) {
    setRespuestas((rs) => rs.map((r) => (r.n === n ? { ...r, ...campos } : r)));
  }

  function zDe(r: Respuesta) {
    return puntajeZ(LAMINA, {
      areas: r.areas,
      localizacion: r.localizacion,
      integradas: r.integradas,
      blancoIntegrado: r.blancoIntegrado,
    });
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
            n_localizacion: r.areas.join('+'),
            localizacion: r.localizacion,
            fq: r.fq,
            contenidos: r.contenidos,
            popular: r.popular,
            z: zDe(r).z?.valor ?? null,
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
  const dudas = respuestas.reduce((s, r) => s + zDe(r).aConfirmar.length, 0);

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
            {puestas.length > 0 && (
              <button type="button" className="os-boton" onClick={() => setPuestas([])}>
                Soltar {puestas.join(' + ')}
              </button>
            )}
          </div>

          <div className="os-ror-lienzo">
            <img src="/api/os/lamina/rorschach/1" alt="Lámina I" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {visibles.map((a) =>
                (AREAS[a] ?? []).map((parte, i) => (
                  <path
                    key={`${a}-${i}`}
                    d={camino(parte)}
                    className={
                      'os-ror-area' +
                      (puestas.includes(a) ? ' os-ror-area-puesta' : '') +
                      (encima === a ? ' os-ror-area-encima' : '')
                    }
                    onMouseEnter={() => setEncima(a)}
                    onMouseLeave={() => setEncima(null)}
                    onClick={() => alternar(a)}
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
                  className={`os-ror-chip${puestas.includes(a) ? ' os-ror-chip-puesto' : ''}`}
                  onMouseEnter={() => setEncima(a)}
                  onMouseLeave={() => setEncima(null)}
                  onClick={() => alternar(a)}
                >
                  {a}
                </button>
              </li>
            ))}
          </ul>
          <p className="os-ror-aclaracion">
            Marcá más de un área cuando la respuesta las integre: de ahí sale si el
            puntaje Z es ZA, ZD o ZS.
          </p>
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
              Buscar en toda la lámina{principal ? ` · o elegir de ${principal}` : ''}
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
                {principal
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

          {(puestas.length > 0 || dijo.trim()) && (
            <button type="button" className="os-boton" onClick={() => tomar(null)}>
              No está en la tabla: cargar igual
              {puestas.length > 0 ? ` en ${puestas.join(' + ')}` : ''}
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
            {dudas > 0 ? ` · ${dudas} sobre el puntaje Z` : ''}
          </p>
        </div>

        {respuestas.map((r) => {
          const v = zDe(r);
          const tieneEspacio = r.areas.some(esEspacio);
          const tieneTinta = r.areas.some((a) => !esEspacio(a));
          return (
            <article key={r.n} className={`os-ror-fila${r.extrapolada ? ' os-ror-extrapolada' : ''}`}>
              <div className="os-ror-fila-datos">
                <span className="os-ror-n">{r.n}</span>
                <span className="os-ror-dijo">{r.dijo}</span>
                <span className="os-ror-areas">{r.areas.join(' + ')}</span>
                <select
                  className="os-campo"
                  value={r.localizacion ?? ''}
                  onChange={(e) => cambiar(r.n, { localizacion: e.target.value || null })}
                >
                  <option value="">Loc. + DQ</option>
                  {localizacionesDe(r.areas[0]).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <span className="os-ror-dato">{r.fq ?? '—'}</span>
                <span className="os-ror-dato">{r.contenidos.join(', ') || '—'}</span>
                <span className="os-ror-dato">{r.popular ? 'P' : ''}</span>
                <span className="os-ror-dato os-ror-z">
                  {v.z ? `${v.z.tipo} ${v.z.valor}` : '—'}
                </span>
              </div>

              <div className="os-ror-fila-z">
                {r.areas.length >= 2 && (
                  <label className="os-ror-tilde">
                    <input
                      type="checkbox"
                      checked={r.integradas}
                      onChange={(e) => cambiar(r.n, { integradas: e.target.checked })}
                    />
                    Integra las áreas con una relación significativa
                  </label>
                )}
                {(tieneEspacio || (r.localizacion?.includes('S') ?? false)) && (
                  <label className="os-ror-tilde">
                    <input
                      type="checkbox"
                      checked={r.blancoIntegrado}
                      onChange={(e) => cambiar(r.n, { blancoIntegrado: e.target.checked })}
                      disabled={!tieneTinta && !r.localizacion?.match(/^(W|D)S/)}
                    />
                    El blanco se integra con la mancha
                  </label>
                )}
                {v.z && <span className="os-ror-porque">{v.z.tipo}: {v.z.porque}</span>}
                {v.otros.map((o) => (
                  <span key={o.tipo} className="os-ror-porque os-ror-descartado">
                    {o.tipo} {o.valor} también daba, gana el más alto
                  </span>
                ))}
                {v.aConfirmar.map((a, i) => (
                  <span key={i} className="os-ror-duda">
                    {a}
                  </span>
                ))}
                <span className="os-ror-falta">Falta a mano: {faltan(r).join(' · ')}</span>
              </div>
            </article>
          );
        })}

        <div className="os-ror-pie">
          <p className="os-ror-aclaracion">
            Lo que esta pantalla no puede saber, y se completa en la ficha:{' '}
            {PENDIENTES.filter((p) => !['localizacion', 'z'].includes(p.campo))
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
