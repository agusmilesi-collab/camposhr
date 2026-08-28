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
import {
  LARGO_NOMBRE,
  bandasDe,
  colorDe,
  cortesValidos,
  tramosDe,
  type Exigencia,
} from '@/lib/exigencia';

/** Un color como se escribe en el estilo. */
function tono(rgb: [number, number, number]): string {
  return `rgb(${rgb.join(', ')})`;
}

type Fila = Exigencia & { pedidos: number };

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
   *
   * Cuando el perfil está abierto, los tres cortes se arrastran sobre la barra
   * misma. Con las barras deslizantes en filas aparte había que mirar dos cosas
   * a la vez para entender qué se estaba moviendo: acá el pulgar está sobre el
   * borde que separa las dos bandas que cambia.
   */
  function barra(
    e: { sobresaliente: number; alto: number; adecuado: number },
    editable = false
  ) {
    const bandas = bandasDe(e as Exigencia)
      .slice()
      .reverse();
    const tramos = tramosDe(e as Exigencia).map((t, i, todos) => {
      const hasta = i === todos.length - 1 ? 100 : todos[i + 1].desde;
      return `${tono(t.rgb)} ${t.desde}% ${hasta}%`;
    });
    return (
      <div className="os-exigencia-escala">
        <div className={`os-exigencia-pista${editable ? ' os-exigencia-viva' : ''}`}>
          <span
            className="os-exigencia-barra"
            style={{ backgroundImage: `linear-gradient(90deg, ${tramos.join(', ')})` }}
          />
          {editable &&
            CORTES.map((c) => (
              <input
                key={c.clave}
                className="os-exigencia-manija"
                type="range"
                min={1}
                max={100}
                value={e[c.clave]}
                aria-label={c.rotulo}
                onChange={(ev) => mover(c.clave, Number(ev.target.value))}
              />
            ))}
        </div>
        {/* En porcentaje y no en partes proporcionales, como en el informe: la
            separación entre dos rótulos tiene que caer donde la barra cambia de
            color, y el degradado corta en el número a secas. Contando
            `hasta + 1 - desde` cada banda salía un punto más larga y las líneas
            quedaban corridas, justo mientras se mueve un corte. */}
        <div
          className="os-exigencia-rotulos"
          style={{
            gridTemplateColumns: bandas
              .map((b, i, todas) => `${(todas[i + 1]?.desde ?? 100) - b.desde}%`)
              .join(' '),
          }}
        >
          {bandas.map((b) => (
            <span key={b.nombre}>
              <em style={{ color: tono(colorDe(b.hasta, e as Exigencia)) }}>{b.nombre}</em>
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
      <div className="os-exigencia-cabecera">
        {error && !editando && <p className="os-form-error">{error}</p>}
        <button
          className="os-boton os-boton-azul"
          disabled={guardando || editando === 'nueva'}
          onClick={() => abrir(null)}
        >
          Nueva exigencia
        </button>
      </div>

      <div className="os-redacciones">
        {exigencias.map((e) => {
          const abierta = editando === e.id;
          const v = abierta && puesta ? puesta : e;
          return (
            <section className="os-panel os-indice-panel" key={e.id}>
              <div className="os-panel-top">
                {/* El sello pegado al nombre y no suelto en la fila: dice algo
                    de este perfil y no de la pantalla. */}
                <h3 className="os-indice-nombre-titulo os-exigencia-nombre">
                  {e.nombre}
                  {e.predeterminada && (
                    <span
                      className="os-sello-estado os-verde"
                      title="Es la que rige cuando el pedido no pide otra"
                    >
                      Default
                    </span>
                  )}
                </h3>
                {/* Cuántos la usan, solo cuando alguno la usa: "sin usar" no
                    dice nada que valga el lugar que ocupa, y lo que importa de
                    este número es que mover un corte cambia cómo se leen esos
                    pedidos. */}
                {e.pedidos > 0 && (
                  <span className="os-columna-monto">
                    {e.pedidos} {e.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </span>
                )}
              </div>

              <div className="os-panel-cuerpo">
                {barra(v, abierta)}

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
                  <div className="os-exigencia-pieza">
                    {e.notas && <p className="os-form-nota os-exigencia-nota">{e.notas}</p>}
                    <span className="os-exigencia-acciones">
                      <button
                        className="os-boton"
                        disabled={!hayTabla || guardando}
                        onClick={() => abrir(e)}
                        title={hayTabla ? undefined : 'Todavía no hay ninguna guardada'}
                      >
                        Mover los cortes
                      </button>
                      {/* La default no se cambia: es la que rige siempre, y lo
                          que se elige por pedido es apartarse de ella. Un botón
                          para coronar otra volvía a esta pantalla el lugar
                          donde se decide cómo se lee todo el sistema de una
                          vez, que no es lo que se quiere. */}
                      {!e.predeterminada && hayTabla && (
                        <button
                          className="os-boton"
                          disabled={guardando || e.pedidos > 0}
                          title={
                            e.pedidos > 0
                              ? 'La usan pedidos abiertos. Cambiásela a esos pedidos antes de borrarla.'
                              : undefined
                          }
                          onClick={() => mandar({ id: e.id, borrar: true })}
                        >
                          Borrar
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>



      {/* La nueva se edita en su propio panel, al pie: arriba están las
          guardadas y esta todavía no lo está. */}
      {editando === 'nueva' && puesta && (
        <section className="os-panel os-indice-panel">
          <div className="os-panel-top">
            <h3 className="os-indice-nombre-titulo">{puesta.nombre || 'Exigencia nueva'}</h3>
          </div>
          <div className="os-panel-cuerpo">
            {barra(puesta, true)}
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
