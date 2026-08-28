'use client';

/**
 * El análisis discursivo, en la ficha.
 *
 * La evaluadora ubica a la persona en uno de los cuatro estratos. El sistema no
 * deduce el nivel: se toma sobre unos cinco minutos de discurso y lo ubica quien
 * lo escuchó.
 *
 * **El estrato no se elige: sale de lo que se contesta.** Son los mismos dos
 * caminos con los que se determina el nivel del puesto, y por eso las dos
 * puntas caen en la misma escala y se pueden comparar:
 *
 * 1. El **horizonte temporal** que la evaluadora le atribuye después de
 *    escucharlo, que en el modelo es la medida de la capacidad.
 * 2. Las **preguntas de complejidad**, contestadas sobre las dos o tres
 *    asignaciones que la persona manejó al límite de lo que pudo. Es como el
 *    libro indica juzgarlo: no se pregunta el nivel, se piden ejemplos y se
 *    clasifican.
 *
 * Coinciden y el estrato queda firme; discrepan y lo resuelve ella. Sin nada
 * contestado quedan los cuatro estratos para elegir a mano, que es lo que
 * sostiene a las evaluaciones cargadas antes de que esto existiera.
 *
 * **Va sin la pirámide**: dibujarla acá ocupaba media pantalla. La pirámide es
 * del informe, que es donde el cliente la lee.
 *
 * El diagrama de progreso potencial se dibuja acá mismo y no solo en el
 * informe: es la comprobación de que el punto cayó donde la evaluadora
 * esperaba, y si no, el número está a un toque de corregirse.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Opciones from '@/app/os/Opciones';
import type { NivelDiscursivo } from '@/lib/discursivo';
import {
  UNIDADES,
  PREGUNTAS,
  aDias,
  bandaDe,
  comoSeDice,
  desdeDias,
  estratoPorNumero,
  nivelDeRespuestas,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  type Unidad,
} from '@/lib/potencial';
import Progreso from '../../informe/_doc/Progreso';

export default function Discursivo({
  id,
  nivel,
  niveles,
  edad,
  edadEvaluacion,
  dias,
  complejidad,
}: {
  id: string;
  nivel: string | null;
  /** Los cuatro, del más alto al más bajo, con lo que rige. */
  niveles: { nombre: string; romano: string; procesamiento: string; que: string }[];
  /** La edad guardada para el diagrama, si ya se cargó. */
  edad: number | null;
  /** La que quedó congelada el día de la entrevista, si la hay. */
  edadEvaluacion: number | null;
  /** El horizonte guardado, en días. */
  dias: number | null;
  /** Las respuestas de complejidad ya cargadas. */
  complejidad: Record<string, boolean> | null;
}) {
  const router = useRouter();
  const [puesto, setPuesto] = useState(nivel);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La edad arranca con la de la evaluación cuando todavía no se cargó una:
  // volver a escribir un dato que el sistema ya tiene es trabajo de más.
  const [suEdad, setSuEdad] = useState(String(edad ?? edadEvaluacion ?? ''));
  const inicial = dias ? desdeDias(dias) : null;
  const [cuanto, setCuanto] = useState(inicial ? String(inicial.cantidad) : '');
  const [unidad, setUnidad] = useState<Unidad>(inicial?.unidad ?? 'anios');
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>(complejidad ?? {});

  async function mandar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/discursivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, ...cuerpo }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar(elegido: string | null) {
    const antes = puesto;
    setPuesto(elegido);
    if (!(await mandar({ nivel: elegido }))) setPuesto(antes);
  }

  /** La edad se guarda al salir del campo, vacía la borra. */
  async function guardarEdad() {
    const limpio = suEdad.trim();
    const n = limpio ? Number(limpio) : null;
    if (n !== null && !Number.isFinite(n)) return;
    await mandar({ nivel: puesto, edad: n });
  }

  /** El horizonte viaja en días: el par número + unidad es solo para escribirlo. */
  async function guardarHorizonte(cantidad: string, u: Unidad) {
    const limpio = cantidad.trim();
    const n = limpio ? Number(limpio.replace(',', '.')) : null;
    if (n === null) {
      await mandar({ nivel: puesto, horizonteDias: null });
      return;
    }
    const d = aDias(n, u);
    if (d === null) {
      setError('El horizonte tiene que ir entre un día y cincuenta años.');
      return;
    }
    await mandar({ nivel: puesto, horizonteDias: d });
  }

  const edadNum = Number(suEdad);
  const diasNum = aDias(Number(cuanto.replace(',', '.')), unidad);
  const dibuja = Number.isFinite(edadNum) && edadNum >= 16 && edadNum <= 80 && diasNum !== null;
  const banda = dibuja ? bandaDe(edadNum, diasNum as number) : null;
  const hoy = dibuja ? estratoDeEscalon(escalonDe(diasNum as number)) : null;

  /* El estrato por cada camino. El del horizonte sale del punto en la escalera;
     el de las preguntas, de la más alta contestada que sí. */
  const porHorizonte = diasNum !== null ? estratoDeEscalon(escalonDe(diasNum)) : null;
  const porPreguntas = estratoPorNumero(
    nivelDeRespuestas(
      Object.entries(respuestas)
        .filter(([, si]) => si)
        .map(([n]) => Number(n))
    ) ?? 0
  );
  const coinciden =
    porHorizonte && porPreguntas
      ? porHorizonte.romano === porPreguntas.romano
        ? porHorizonte
        : null
      : (porHorizonte ?? porPreguntas);
  const choca = Boolean(porHorizonte && porPreguntas && !coinciden);
  /** Nada contestado todavía: los cuatro estratos quedan para elegir a mano. */
  const aMano = !porHorizonte && !porPreguntas;

  /** El nombre del nivel que le corresponde a un estrato, o null si no lo mide. */
  const nombreDe = (romano: string) => niveles.find((n) => n.romano === romano)?.nombre ?? null;

  /*
   * Las respuestas se acumulan sobre la referencia y no sobre el estado: cuatro
   * preguntas seguidas son cuatro guardados en vuelo, y con el estado a secas
   * la última pisaba a las anteriores.
   */
  const vivas = useRef(respuestas);

  async function contestar(estrato: number, si: boolean | null) {
    const nuevas = { ...vivas.current };
    if (si === null) delete nuevas[String(estrato)];
    else nuevas[String(estrato)] = si;
    vivas.current = nuevas;
    setRespuestas(nuevas);
    await mandar({
      nivel: puesto,
      complejidad: Object.keys(nuevas).length > 0 ? nuevas : null,
    });
  }

  /* El nivel se fija solo cuando los dos caminos coinciden. */
  const salio = coinciden?.romano ?? null;
  useEffect(() => {
    if (choca || !salio) return;
    const nombre = nombreDe(salio);
    if (nombre === puesto) return;
    setPuesto(nombre);
    mandar({ nivel: nombre });
    // Lo que dispara esto es el estrato que salió, no las funciones de guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salio, choca]);

  const elegido = niveles.find((n) => n.nombre === puesto);

  return (
    <div className="os-discursivo">
      {/* Lo primero es el horizonte: en el modelo es la medida de la capacidad,
          y de ahí sale el estrato sin que nadie lo elija. */}
      <div className="os-nivel-bloque">
        <p className="os-nivel-pregunta">
          ¿Cuál es la tarea más larga que esta persona puede llevar hasta el final por
          sí misma, sin que le indiquen cómo?
        </p>
        <div className="os-nivel-tiempo">
          <input
            className="os-control-suave os-potencial-numero"
            inputMode="decimal"
            value={cuanto}
            disabled={guardando}
            placeholder="0"
            onChange={(e) => setCuanto(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))}
            onBlur={() => guardarHorizonte(cuanto, unidad)}
          />
          <select
            className="os-control-suave"
            value={unidad}
            disabled={guardando}
            onChange={(e) => {
              const u = e.target.value as Unidad;
              setUnidad(u);
              guardarHorizonte(cuanto, u);
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u.clave} value={u.clave}>
                {u.texto}
              </option>
            ))}
          </select>
          <span className={`os-nivel-sale${porHorizonte ? '' : ' vacio'}`}>
            {porHorizonte ? `Estrato ${porHorizonte.romano}` : 'sin contestar'}
          </span>
        </div>
      </div>

      {/* Las preguntas van sobre las asignaciones que manejó al límite de lo que
          pudo, no sobre lo que sabe hacer: es lo que el libro indica pedir. */}
      <div className="os-nivel-bloque">
        <p className="os-nivel-pregunta">
          Tomando las dos o tres asignaciones que manejó al límite de lo que pudo,
          ¿qué le exigieron?
        </p>
        <ol className="os-nivel-preguntas">
          {PREGUNTAS.filter((p) => p.estrato <= 4).map((p) => (
            <li key={p.estrato}>
              <span className="os-nivel-texto">
                <strong>{p.corto}</strong>
                <small>{p.texto}</small>
              </span>
              <Opciones
                valor={respuestas[String(p.estrato)] ?? null}
                opciones={[
                  { v: true as boolean | null, texto: 'Sí' },
                  { v: false as boolean | null, texto: 'No' },
                ]}
                alElegir={(v) =>
                  contestar(p.estrato, respuestas[String(p.estrato)] === v ? null : (v as boolean))
                }
                etiqueta={p.corto}
              />
            </li>
          ))}
        </ol>
        <span className={`os-nivel-sale${porPreguntas ? '' : ' vacio'}`}>
          {porPreguntas ? `Estrato ${porPreguntas.romano}` : 'sin contestar'}
        </span>
      </div>

      {choca && (
        <p className="os-potencial-choca">
          El horizonte da estrato {porHorizonte?.romano} y las preguntas dan estrato{' '}
          {porPreguntas?.romano}. Elegí cuál rige.
        </p>
      )}

      {/* El estrato que queda. Sin nada contestado, los cuatro para elegir a
          mano: es lo que sostiene a las evaluaciones cargadas antes. */}
      <div className="os-nivel-cierre">
        <span className="os-etiqueta-campo">
          {aMano || choca ? 'Elegí el estrato' : 'La persona está en'}
        </span>
        {aMano || choca ? (
          <ol className="os-estratos-elegir" role="radiogroup" aria-label="Estrato">
            {niveles
              .filter(
                (n) =>
                  !choca ||
                  n.romano === porHorizonte?.romano ||
                  n.romano === porPreguntas?.romano
              )
              .map((n) => {
                const suyo = puesto === n.nombre;
                return (
                  <li key={n.nombre}>
                    <button
                      type="button"
                      role="radio"
                      className={`os-estrato-opcion${suyo ? ' suyo' : ''}`}
                      disabled={guardando}
                      aria-checked={suyo}
                      // Volver a apretar el que ya estaba lo desmarca: es la
                      // forma de corregir sin elegir otro que no corresponde.
                      onClick={() => guardar(suyo ? null : (n.nombre as NivelDiscursivo))}
                    >
                      <span className="os-estrato-marca" aria-hidden="true" />
                      <span className="os-estrato-texto">
                        <span className="os-estrato-titulo">
                          <strong>{n.nombre}</strong>
                          <span className="os-estrato-numeral">Estrato {n.romano}</span>
                        </span>
                        <small>{n.que}</small>
                      </span>
                      <span className="os-estrato-proceso">{n.procesamiento}</span>
                    </button>
                  </li>
                );
              })}
          </ol>
        ) : (
          <p className="os-nivel-resultado">
            {elegido ? (
              <>
                <strong>Estrato {elegido.romano}</strong> · {elegido.nombre}
              </>
            ) : (
              <span className="os-tabla-flojo">
                {coinciden
                  ? `Estrato ${coinciden.romano}, por encima de lo que mide este análisis`
                  : 'sin determinar'}
              </span>
            )}
          </p>
        )}
      </div>

      {/* El diagrama necesita además la edad. El horizonte ya se cargó arriba:
          es el mismo dato con el que se determina el estrato. */}
      <div className="os-potencial-datos">
        <span className="os-etiqueta-campo">Diagrama de progreso potencial</span>
        <div className="os-potencial-campos">
          <label className="os-potencial-campo">
            <span>Edad</span>
            <input
              className="os-control-suave os-potencial-numero"
              inputMode="numeric"
              value={suEdad}
              disabled={guardando}
              onChange={(e) => setSuEdad(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onBlur={guardarEdad}
            />
          </label>

        </div>

        {/* Lo que dice el punto, en una línea: el estrato de hoy y hasta dónde
            llega su banda. Es la comprobación de que el dato quedó bien. */}
        {dibuja && hoy && banda !== null && (
          <>
            <p className="os-potencial-lectura">
              Hoy en el estrato <strong>{hoy.romano}</strong>
              {hoy.mide ? ` · ${hoy.nombre}` : ''}. Por su banda llega a{' '}
              <strong>{comoSeDice(estratoDeEscalon(horizonteEn(banda, 50)))}</strong> a los 50 y a{' '}
              <strong>{comoSeDice(estratoDeEscalon(horizonteEn(banda, 60)))}</strong> a los 60.
            </p>
            <div className="os-potencial-grafico">
              <Progreso edad={edadNum} dias={diasNum as number} />
            </div>
          </>
        )}
      </div>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
