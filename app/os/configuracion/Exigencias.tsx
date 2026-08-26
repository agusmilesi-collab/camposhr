'use client';

/**
 * Los perfiles de exigencia, con los cortes movibles.
 *
 * La barra de arriba de cada perfil es la misma que sale en el informe, con los
 * mismos colores y los mismos anchos: se corrige mirando lo que el cliente va a
 * ver. Los tres cortes se mueven con la barra deslizante de abajo y la de
 * arriba se redibuja mientras se arrastra.
 *
 * **Mover un corte no recalcula ningún puntaje.** Cambia el nombre que le toca:
 * el 62 de una competencia sigue siendo 62, y pasa de Adecuado a Bajo o al
 * revés según dónde quede el corte.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LARGO_NOMBRE, bandasDe, cortesValidos, type Exigencia } from '@/lib/exigencia';

/** Los colores de la escala del informe, para que la barra se vea igual. */
const COLORES: { desde: number; rgb: [number, number, number] }[] = [
  { desde: 80, rgb: [58, 122, 74] },
  { desde: 65, rgb: [110, 163, 118] },
  { desde: 35, rgb: [67, 100, 143] },
  { desde: 18, rgb: [193, 89, 26] },
  { desde: 0, rgb: [140, 59, 59] },
];

function tono(puntaje: number): string {
  const base = COLORES.find((t) => puntaje >= t.desde) ?? COLORES[4];
  return `rgb(${base.rgb.join(', ')})`;
}

type Fila = Exigencia & { pedidos: number; candidatos: number };

/** Lo que se está editando de un perfil, todavía sin guardar. */
type Puesta = { nombre: string; sobresaliente: number; alto: number; adecuado: number; notas: string };

const CORTES = [
  { clave: 'adecuado', rotulo: 'Adecuado desde' },
  { clave: 'alto', rotulo: 'Alto desde' },
  { clave: 'sobresaliente', rotulo: 'Sobresaliente desde' },
] as const;

export default function Exigencias({
  exigencias,
  hayTabla,
}: {
  exigencias: Fila[];
  /** False mientras la tabla no tenga ninguna: se muestra la del código. */
  hayTabla: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [puesta, setPuesta] = useState<Puesta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(e: Fila | null) {
    setError(null);
    if (!e) {
      const base = exigencias.find((x) => x.predeterminada) ?? exigencias[0];
      setEditando('nueva');
      setPuesta({
        nombre: '',
        sobresaliente: base.sobresaliente,
        alto: base.alto,
        adecuado: base.adecuado,
        notas: '',
      });
      return;
    }
    setEditando(e.id);
    setPuesta({
      nombre: e.nombre,
      sobresaliente: e.sobresaliente,
      alto: e.alto,
      adecuado: e.adecuado,
      notas: e.notas ?? '',
    });
  }

  async function mandar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/exigencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error ?? 'No se pudo guardar.');
      setEditando(null);
      setPuesta(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /**
   * La barra con las cuatro bandas y sus números.
   *
   * El ancho de cada tramo es el ancho real de la banda, así que se ve de una
   * cuánto de la escala se lleva cada una. Adecuado es la que más se mueve.
   */
  function barra(e: { sobresaliente: number; alto: number; adecuado: number }) {
    const bandas = bandasDe(e as Exigencia).slice().reverse();
    const tramos = COLORES.slice()
      .reverse()
      .map((t, i, todos) => {
        const hasta = i === todos.length - 1 ? 100 : todos[i + 1].desde;
        return `${tono(t.desde)} ${t.desde}% ${hasta}%`;
      });
    return (
      <div className="os-exigencia-escala">
        <span
          className="os-exigencia-barra"
          style={{ backgroundImage: `linear-gradient(90deg, ${tramos.join(', ')})` }}
        />
        <div
          className="os-exigencia-rotulos"
          style={{ gridTemplateColumns: bandas.map((b) => `${b.hasta + 1 - b.desde}fr`).join(' ') }}
        >
          {bandas.map((b) => (
            <span key={b.nombre}>
              <em style={{ color: tono(b.desde === 0 ? 20 : b.desde) }}>{b.nombre}</em>
              {b.desde === 0 ? `menos de ${e.adecuado}` : `${b.desde} a ${b.hasta}`}
            </span>
          ))}
        </div>
      </div>
    );
  }

  /**
   * Mover un corte arrastra a los vecinos.
   *
   * Sin esto, subir el de Adecuado por encima del de Alto dejaba una banda dada
   * vuelta que la ruta rechaza recién al guardar. Acá el corte de al lado se
   * corre solo y siempre quedan los cinco puntos mínimos entre uno y otro.
   */
  function mover(cual: (typeof CORTES)[number]['clave'], valor: number) {
    setPuesta((p) => {
      if (!p) return p;
      const n = { ...p, [cual]: valor };
      if (cual === 'adecuado') {
        n.alto = Math.max(n.alto, n.adecuado + 5);
        n.sobresaliente = Math.max(n.sobresaliente, n.alto + 5);
      } else if (cual === 'alto') {
        n.adecuado = Math.min(n.adecuado, n.alto - 5);
        n.sobresaliente = Math.max(n.sobresaliente, n.alto + 5);
      } else {
        n.alto = Math.min(n.alto, n.sobresaliente - 5);
        n.adecuado = Math.min(n.adecuado, n.alto - 5);
      }
      return n;
    });
  }

  const mal = puesta ? cortesValidos(puesta) : null;

  return (
    <>
      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            El puntaje de una competencia sale del protocolo y no se toca desde acá. Lo que se
            decide es a partir de qué número se lo llama Adecuado, Alto o Sobresaliente. El
            mismo 62 puede alcanzar para un rol operativo y quedarse corto para una gerencia:
            por eso hay más de un perfil y el pedido elige con cuál se lee.
          </p>
          <p className="os-form-nota">
            Un informe usa la exigencia del candidato; si no tiene, la de su pedido; y si
            tampoco, la predeterminada. Mover un corte no recalcula ningún puntaje, cambia el
            nombre que le toca.
          </p>
        </div>
      </section>

      <div className="os-redacciones">
        {exigencias.map((e) => {
          const abierta = editando === e.id;
          const v = abierta && puesta ? puesta : e;
          return (
            <section className="os-panel os-indice-panel" key={e.id}>
              <div className="os-panel-top">
                <h3 className="os-indice-nombre-titulo">{e.nombre}</h3>
                {e.predeterminada && <span className="os-etiqueta-si">predeterminada</span>}
                <span className="os-columna-monto">
                  {e.pedidos === 0 && e.candidatos === 0
                    ? 'sin usar'
                    : [
                        e.pedidos > 0 && `${e.pedidos} ${e.pedidos === 1 ? 'pedido' : 'pedidos'}`,
                        e.candidatos > 0 &&
                          `${e.candidatos} ${e.candidatos === 1 ? 'candidato' : 'candidatos'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </div>

              <div className="os-panel-cuerpo">
                {barra(v)}

                {abierta && puesta ? (
                  <div className="os-exigencia-edicion">
                    <div className="os-exigencia-campo">
                      <label className="os-etiqueta-campo" htmlFor={`nombre-${e.id}`}>
                        Nombre
                      </label>
                      <input
                        id={`nombre-${e.id}`}
                        className="os-campo"
                        type="text"
                        maxLength={LARGO_NOMBRE}
                        value={puesta.nombre}
                        onChange={(ev) =>
                          setPuesta((p) => (p ? { ...p, nombre: ev.target.value } : p))
                        }
                      />
                    </div>

                    {CORTES.map((c) => (
                      <div className="os-exigencia-corte" key={c.clave}>
                        <label htmlFor={`${c.clave}-${e.id}`}>{c.rotulo}</label>
                        <input
                          id={`${c.clave}-${e.id}`}
                          className="os-exigencia-slider"
                          type="range"
                          min={1}
                          max={100}
                          value={puesta[c.clave]}
                          onChange={(ev) => mover(c.clave, Number(ev.target.value))}
                        />
                        <output>{puesta[c.clave]}</output>
                      </div>
                    ))}

                    <div className="os-exigencia-campo">
                      <label className="os-etiqueta-campo" htmlFor={`notas-${e.id}`}>
                        Para qué es
                      </label>
                      <textarea
                        id={`notas-${e.id}`}
                        className="os-campo os-exigencia-notas"
                        value={puesta.notas}
                        placeholder="Cuándo conviene usar esta y no otra"
                        onChange={(ev) =>
                          setPuesta((p) => (p ? { ...p, notas: ev.target.value } : p))
                        }
                      />
                    </div>

                    {(mal || error) && <p className="os-form-error">{mal ?? error}</p>}

                    <div className="os-barra-acciones">
                      <button
                        className="os-boton"
                        disabled={guardando}
                        onClick={() => {
                          setEditando(null);
                          setPuesta(null);
                          setError(null);
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="os-boton os-boton-azul"
                        disabled={guardando || Boolean(mal) || !puesta.nombre.trim()}
                        onClick={() =>
                          mandar({
                            id: editando === 'nueva' ? '' : e.id,
                            nombre: puesta.nombre,
                            sobresaliente: puesta.sobresaliente,
                            alto: puesta.alto,
                            adecuado: puesta.adecuado,
                            notas: puesta.notas,
                          })
                        }
                      >
                        {guardando ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {e.notas && <p className="os-form-nota">{e.notas}</p>}
                    <div className="os-barra-acciones">
                      <button
                        className="os-boton"
                        disabled={!hayTabla || guardando}
                        onClick={() => abrir(e)}
                        title={hayTabla ? undefined : 'Todavía no hay ninguna guardada'}
                      >
                        Mover los cortes
                      </button>
                      {!e.predeterminada && hayTabla && (
                        <>
                          <button
                            className="os-boton"
                            disabled={guardando}
                            onClick={() => mandar({ id: e.id, predeterminar: true })}
                          >
                            Poner de predeterminada
                          </button>
                          <button
                            className="os-boton"
                            disabled={guardando || e.pedidos > 0 || e.candidatos > 0}
                            title={
                              e.pedidos > 0 || e.candidatos > 0
                                ? 'La están usando. Cambiásela a esos pedidos antes de borrarla.'
                                : undefined
                            }
                            onClick={() => mandar({ id: e.id, borrar: true })}
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          {error && !editando && <p className="os-form-error">{error}</p>}
          <div className="os-barra-acciones">
            <button
              className="os-boton os-boton-azul"
              disabled={guardando || editando === 'nueva'}
              onClick={() => abrir(null)}
            >
              Nueva exigencia
            </button>
          </div>
        </div>
      </section>

      {/* La nueva se edita en su propio panel, al pie: arriba están las
          guardadas y esta todavía no lo está. */}
      {editando === 'nueva' && puesta && (
        <section className="os-panel os-indice-panel">
          <div className="os-panel-top">
            <h3 className="os-indice-nombre-titulo">{puesta.nombre || 'Exigencia nueva'}</h3>
          </div>
          <div className="os-panel-cuerpo">
            {barra(puesta)}
            <div className="os-exigencia-edicion">
              <div className="os-exigencia-campo">
                <label className="os-etiqueta-campo" htmlFor="nombre-nueva">
                  Nombre
                </label>
                <input
                  id="nombre-nueva"
                  className="os-campo"
                  type="text"
                  maxLength={LARGO_NOMBRE}
                  value={puesta.nombre}
                  placeholder="Por ejemplo: Operativo"
                  onChange={(ev) => setPuesta((p) => (p ? { ...p, nombre: ev.target.value } : p))}
                />
              </div>

              {CORTES.map((c) => (
                <div className="os-exigencia-corte" key={c.clave}>
                  <label htmlFor={`${c.clave}-nueva`}>{c.rotulo}</label>
                  <input
                    id={`${c.clave}-nueva`}
                    className="os-exigencia-slider"
                    type="range"
                    min={1}
                    max={100}
                    value={puesta[c.clave]}
                    onChange={(ev) => mover(c.clave, Number(ev.target.value))}
                  />
                  <output>{puesta[c.clave]}</output>
                </div>
              ))}

              <div className="os-exigencia-campo">
                <label className="os-etiqueta-campo" htmlFor="notas-nueva">
                  Para qué es
                </label>
                <textarea
                  id="notas-nueva"
                  className="os-campo os-exigencia-notas"
                  value={puesta.notas}
                  placeholder="Cuándo conviene usar esta y no otra"
                  onChange={(ev) => setPuesta((p) => (p ? { ...p, notas: ev.target.value } : p))}
                />
              </div>

              {(mal || error) && <p className="os-form-error">{mal ?? error}</p>}

              <div className="os-barra-acciones">
                <button
                  className="os-boton"
                  disabled={guardando}
                  onClick={() => {
                    setEditando(null);
                    setPuesta(null);
                    setError(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="os-boton os-boton-azul"
                  disabled={guardando || Boolean(mal) || !puesta.nombre.trim()}
                  onClick={() =>
                    mandar({
                      nombre: puesta.nombre,
                      sobresaliente: puesta.sobresaliente,
                      alto: puesta.alto,
                      adecuado: puesta.adecuado,
                      notas: puesta.notas,
                    })
                  }
                >
                  {guardando ? 'Creando…' : 'Crear la exigencia'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
