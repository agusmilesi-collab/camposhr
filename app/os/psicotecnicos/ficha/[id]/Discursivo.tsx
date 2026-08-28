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
import { nivelesQueRigen, type NivelDiscursivo } from '@/lib/discursivo';
import type { Estrato } from '@/lib/potencial';
import {
  APERTURA,
  EDAD_MAX,
  EDAD_MIN,
  AVISO_HORIZONTE,
  ESTRATOS,
  PREGUNTAS,
  PREGUNTA_HORIZONTE,
  UNIDADES,
  aDias,
  bandaDe,
  comoSeDice,
  desdeDias,
  estratoPorNumero,
  nivelDeRespuestas,
  plazoDe,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  type Unidad,
} from '@/lib/potencial';
import Progreso from '../../informe/_doc/Progreso';

export default function Discursivo({
  id,
  nivel,
  niveles: susNiveles,
  edad,
  edadEvaluacion,
  dias,
  complejidad,
  relato,
  estratoPuesto,
  pedidoId,
  modo = 'codificacion',
}: {
  id: string;
  nivel: string | null;
  /** Los cuatro, del más alto al más bajo, con lo que rige. */
  niveles?: {
    nombre: string;
    romano: string;
    procesamiento: string;
    que: string;
    horizonte: string;
  }[];
  /** La edad guardada para el diagrama, si ya se cargó. */
  edad: number | null;
  /** La que quedó congelada el día de la entrevista, si la hay. */
  edadEvaluacion: number | null;
  /** El horizonte guardado, en días. */
  dias: number | null;
  /** Las respuestas de complejidad ya cargadas. */
  complejidad: Record<string, boolean> | null;
  /** Lo que la persona contó, anotado en la entrevista. Es de dónde se codifica. */
  relato: string | null;
  /** El nivel de trabajo del puesto, contra el que se compara. */
  estratoPuesto?: number | null;
  /** El pedido, para poder ir a completarlo desde la entrevista. */
  pedidoId?: string | null;
  /**
   * Dónde se está usando.
   *
   * En la entrevista se ve qué preguntarle y se contesta mientras habla; en la
   * codificación se lee lo anotado, sale el estrato y se dibuja el diagrama. Es
   * el mismo dato en los dos lados, así que es el mismo componente: separarlos
   * era mantener dos formularios que escriben las mismas columnas.
   */
  modo?: 'entrevista' | 'codificacion';
}) {
  const router = useRouter();
  // Sin lista propia, la del catálogo: la hoja de la entrevista no lee la
  // configuración, y lo único que se usa de acá es el nombre de cada estrato.
  const niveles = susNiveles ?? nivelesQueRigen();
  const enEntrevista = modo === 'entrevista';
  const [puesto, setPuesto] = useState(nivel);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * La edad sale de la fecha de nacimiento, que se carga en la entrevista.
   *
   * Manda la de la evaluación, que sale de la fecha de nacimiento cargada en la
   * entrevista. La guardada en el análisis queda de respaldo para las
   * evaluaciones viejas que no tienen fecha de nacimiento.
   */
  const suEdad = String(edadEvaluacion ?? edad ?? '');
  const inicial = dias ? desdeDias(dias) : null;
  const [cuanto, setCuanto] = useState(inicial ? String(inicial.cantidad) : '');
  const [unidad, setUnidad] = useState<Unidad>(inicial?.unidad ?? 'anios');
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>(complejidad ?? {});
  const [contado, setContado] = useState(relato ?? '');

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

  /** Lo que contó, al soltar el campo: se escribe de a ratos mientras habla. */
  async function guardarRelato() {
    if (contado === (relato ?? '')) return;
    await mandar({ relato: contado.trim() || null });
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

  /**
   * Si el potencial está tomado: el plazo y las cuatro preguntas.
   *
   * Se calcula acá y no en el servidor: la pastilla tiene que cambiar en el
   * momento en que se marca la última respuesta, y esperando al redibujo del
   * servidor quedaba un segundo diciendo lo contrario de lo que se ve.
   */
  const tomado =
    diasNum !== null &&
    [1, 2, 3, 4].every((n) => typeof respuestas[String(n)] === 'boolean');

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
      {enEntrevista && (
        /* El título del bloque con su marca, como la cabeza de cualquier test. */
        <div className="os-competencias-cabeza">
          <h4 className="os-competencias-titulo">Potencial de desarrollo</h4>
          <span
            className={`os-sello-estado os-test-estado ${tomado ? 'os-verde' : 'os-gris'}`}
          >
            {tomado ? 'Administrado' : 'No administrado'}
          </span>
        </div>
      )}

      {enEntrevista ? (
        <>
      {/* Lo que contó, arriba de todo: es el material del que sale todo lo
            demás, y codificar de memoria es codificar mal. Se escribe mientras
            habla y después se lee para codificar. */}
        {enEntrevista ? (
          <div className="os-nivel-bloque">
            <p className="os-nivel-pregunta">
              <span className="os-nivel-numero">1</span>
              {APERTURA}
            </p>
            <textarea
              className="os-campo os-relato-campo"
              rows={5}
              maxLength={4000}
              value={contado}
              disabled={guardando}
              placeholder="Cada cosa que cuente, en un renglón: qué era, qué tenía que resolver y cuánto duró."
              onChange={(e) => setContado(e.target.value)}
              onBlur={guardarRelato}
            />
          </div>
        ) : (
          <div className="os-relato-leido">
            <span className="os-etiqueta-campo">Lo que contó</span>
            {relato ? (
              <p>{relato}</p>
            ) : (
              <p className="os-tabla-flojo">
                Sin anotar. Se escribe en la hoja de la entrevista, mientras la persona habla.
              </p>
            )}
          </div>
        )}

        {/* Después el horizonte: en el modelo es la medida de la capacidad, y de
            ahí sale el estrato sin que nadie lo elija. */}
        <div className="os-nivel-bloque">
          <p className="os-nivel-pregunta">
            {enEntrevista && <span className="os-nivel-numero">2</span>}
            {enEntrevista
              ? PREGUNTA_HORIZONTE
              : '¿Cuál es la tarea más larga que esta persona puede llevar hasta el final por sí misma, sin que le indiquen cómo?'}
          </p>
          {/* La confusión que arruina la medición: el plazo del resultado contra
              las horas de trabajo que cuesta producirlo. */}
          <p className="os-nivel-aviso">{AVISO_HORIZONTE}</p>
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
            {enEntrevista && <span className="os-nivel-numero">3</span>}
            {enEntrevista
              ? 'Sobre esa tarea, ¿qué le exige? Se pregunta y se marca acá mismo.'
              : 'Tomando las dos o tres asignaciones que manejó al límite de lo que pudo, ¿qué le exigieron?'}
          </p>
          <ol className="os-nivel-preguntas">
            {PREGUNTAS.filter((p) => p.estrato <= 4).map((p) => (
              <li key={p.estrato}>
                <span className="os-nivel-texto">
                  <strong>{p.corto}</strong>
                  {/* En la entrevista, la pregunta tal como se le hace a la
                      persona; codificando, la que describe el trabajo. */}
                  <small>{enEntrevista ? p.alCandidato : p.texto}</small>
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
        </div>

        {choca && (
          <p className="os-potencial-choca">
            El plazo da estrato {porHorizonte?.romano} y las preguntas dan estrato{' '}
            {porPreguntas?.romano}. Se resuelve en la pestaña Potencial, con el puesto
            delante.
          </p>
        )}

        {/* El estrato que queda. Sin nada contestado, los cuatro para elegir a
            mano: es lo que sostiene a las evaluaciones cargadas antes. */}
        {/* Contra qué se va a comparar esto, que es lo único que la evaluadora
            necesita saber acá: si el pedido tiene su nivel determinado. En qué
            estrato quedó la persona se lee en la pestaña Potencial, con la
            comparación delante. */}
        <div className="os-nivel-cierre">
          <span className="os-etiqueta-campo">Información sobre el puesto proyectado</span>
          <p className="os-nivel-resultado os-nivel-puesto">
            <span
              className={`os-sello-estado ${estratoPuesto ? 'os-verde' : 'os-rojo'}`}
            >
              {estratoPuesto
                ? `Estrato ${estratoPorNumero(estratoPuesto)?.romano ?? ''}`
                : 'Sin nivel determinado'}
            </span>
            {pedidoId && (
              <a
                className="os-boton"
                href={`/os/pedidos/${pedidoId}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir el pedido
              </a>
            )}
          </p>
        </div>

        </>
      ) : (
        /* Codificando, las preguntas ya están contestadas en la entrevista: lo
           que hace falta acá es la comparación, que es lo que decide. */
        <>
          <Comparacion
            persona={elegido ? { romano: elegido.romano, nombre: elegido.nombre } : null}
            puesto={estratoPuesto ? estratoPorNumero(estratoPuesto) : null}
            banda={banda}
            niveles={niveles}
          />

          {/* La conclusión, debajo de la tabla y con su rótulo: es lo que se
              lee después de comparar los dos números. */}
          {elegido && estratoPuesto && estratoPorNumero(estratoPuesto) && (
            <div className="os-conclusion">
              <span className="os-etiqueta-campo">Conclusión</span>
              <Conclusion
                distancia={
                  ESTRATOS.findIndex((e) => e.romano === elegido.romano) -
                  ESTRATOS.findIndex(
                    (e) => e.romano === estratoPorNumero(estratoPuesto)?.romano
                  )
                }
                puesto={estratoPorNumero(estratoPuesto) as Estrato}
                banda={banda}
                edad={dibuja ? edadNum : null}
              />
            </div>
          )}

          {/* Y el estrato a mano, en los dos casos en que el sistema no lo
              puede resolver: cuando los dos caminos discrepan y cuando en la
              entrevista no se contestó ninguno. */}
          {(aMano || choca) && (
            <div className="os-nivel-cierre">
              <span className="os-etiqueta-campo">
                {choca
                  ? 'El horizonte y las preguntas discrepan: elegí cuál rige'
                  : 'Sin contestar en la entrevista: elegilo a mano'}
              </span>
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
            </div>
          )}
        </>
      )}

      {/* El diagrama no va en la entrevista: ahí la pantalla es para escuchar y
          marcar, y un dibujo que se recalcula a cada toque distrae de eso. Se
          mira al codificar, que es cuando hay que leerlo.

          La edad sale de la fecha de nacimiento, que se carga en la hoja de la
          entrevista: escribirla otra vez acá es un dato repetido que puede
          quedar distinto del que ya está guardado. */}
      {!enEntrevista && (
      <div className="os-potencial-datos">
        <span className="os-etiqueta-campo">Diagrama de progreso potencial</span>
        {dibuja ? (
          <div className="os-potencial-grafico">
            <Progreso edad={edadNum} dias={diasNum as number} />
            {/* Qué es cada punto, escrito: el globo del navegador tarda un
                segundo en aparecer y hay que pegarle al punto para verlo. */}
            <p className="os-potencial-pie">
              El punto lleno es hoy. Los huecos son a qué estrato llega su banda de
              maduración a los 50 y a los 60 años; al pasar por encima de cada uno dice
              con qué horizonte.
            </p>
          </div>
        ) : (
          <p className="os-tabla-flojo">
            {edadEvaluacion === null && edad === null
              ? 'Falta la edad, que sale de la fecha de nacimiento: se carga en la hoja de la entrevista.'
              : 'Falta el plazo de la tarea, que se contesta en la hoja de la entrevista.'}
          </p>
        )}
      </div>

      )}

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}

/**
 * La comparación que decide: qué pide el puesto y hasta dónde llega la persona.
 *
 * Tres renglones y no un párrafo: lo que hay que ver es si los dos primeros
 * números coinciden, y eso se lee de un vistazo cuando están uno debajo del
 * otro. El tercero dice cuándo alcanza el nivel siguiente, que es lo que el
 * puesto va a pedir más adelante.
 */
function Comparacion({
  persona,
  puesto,
  banda,
  niveles,
}: {
  persona: { romano: string; nombre: string } | null;
  puesto: Estrato | null;
  /** La banda de maduración, para proyectar. Null sin edad ni horizonte. */
  banda: number | null;
  /** El catálogo, para el detalle de cada estrato. */
  niveles: { romano: string; nombre: string; procesamiento: string; que: string; horizonte: string }[];
}) {
  const detalle = (romano: string) => niveles.find((n) => n.romano === romano) ?? null;
  const numeroDe = (romano: string) => ESTRATOS.findIndex((e) => e.romano === romano);

  /** Un renglón: de quién es, en qué nivel está y qué significa ese nivel. */
  const fila = (que: string, romano: string | null, cuando: string | null, falta: string) => {
    const d = romano ? detalle(romano) : null;
    const e = romano ? ESTRATOS.find((x) => x.romano === romano) : null;
    const mecanismo = romano
      ? PREGUNTAS.find((q) => q.estrato === numeroDe(romano) + 1) ?? null
      : null;
    return (
      <tr key={que}>
        <th>
          {que}
          {cuando && <span className="os-comparacion-cuando">{cuando}</span>}
        </th>
        <td>
          {romano ? (
            <>
              <strong>Estrato {romano}</strong>
              <span>{d?.nombre ?? (e?.mide ? e.nombre : e?.grupo) ?? ''}</span>
            </>
          ) : (
            <span className="os-tabla-flojo">{falta}</span>
          )}
        </td>
        {/* Qué clase de problemas se resuelven en ese nivel, dicho para quien no
            conoce el modelo. El nombre del mecanismo va arriba porque es el que
            aparece en el informe y en las preguntas de la entrevista. */}
        <td className="os-comparacion-que">
          {mecanismo ? (
            <>
              <strong>{mecanismo.corto}</strong>
              <span>{mecanismo.simple}</span>
            </>
          ) : (
            <span className="os-tabla-flojo">—</span>
          )}
        </td>
        <td className="os-comparacion-horizonte">
          {e ? plazoDe(e) : <span className="os-tabla-flojo">—</span>}
        </td>
      </tr>
    );
  };

  return (
    <>
      {/* Qué se está comparando, antes de la tabla: sin esto son tres renglones
          de números romanos. */}
      <p className="os-comparacion-intro">
        El puesto y la persona se miden con la misma escala: el nivel de complejidad del
        trabajo que cada uno alcanza, del I al VII.
      </p>
      <table className="os-comparacion">
        <thead>
          <tr>
            <th />
            <th>Nivel de trabajo</th>
            <th>Qué clase de problemas resuelve</th>
            <th>Plazo del que responde</th>
          </tr>
        </thead>
        <tbody>
          {fila(
            'El puesto pide',
            puesto?.romano ?? null,
            null,
            'Sin determinar. Se contesta en la ficha del pedido.'
          )}
          {fila(
            'La persona, hoy',
            persona?.romano ?? null,
            null,
            'Sin determinar. Se contesta en la hoja de la entrevista.'
          )}
          {banda !== null &&
            fila(
              'La persona, más adelante',
              estratoDeEscalon(horizonteEn(banda, 50)).romano,
              'a los 50 años',
              ''
            )}
        </tbody>
      </table>
    </>
  );
}

/**
 * Qué se concluye de la comparación, en dos tiempos.
 *
 * **Hoy y más adelante van en renglones separados.** En un solo párrafo se
 * mezclan los tiempos verbales ("puede hoy" con "va a quedarle corto") y hay
 * que leerlo dos veces para saber qué parte es de ahora y qué parte es una
 * proyección. Separados, cada uno tiene un solo tiempo: el primero en presente,
 * el segundo en futuro.
 *
 * Las tres salidas son distintas de verdad y no matices de la misma: alcanza,
 * sobra o falta.
 */
function Conclusion({
  distancia,
  puesto,
  banda,
  edad,
}: {
  distancia: number;
  puesto: Estrato;
  banda: number | null;
  edad: number | null;
}) {
  /** A qué edad su banda alcanza ese estrato. Null si no llega en el cuadro. */
  const cuandoLlega = (nivel: number): number | null => {
    if (banda === null || edad === null) return null;
    for (let e = Math.max(edad, EDAD_MIN); e <= EDAD_MAX; e++) {
      const suyo = ESTRATOS.findIndex(
        (x) => x.romano === estratoDeEscalon(horizonteEn(banda, e)).romano
      );
      if (suyo >= nivel) return e;
    }
    return null;
  };

  const pide = ESTRATOS.findIndex((e) => e.romano === puesto.romano);
  const siguiente = ESTRATOS[pide + 1] ?? null;

  const hoy =
    distancia === 0
      ? `La persona puede abordar la complejidad que el puesto exige: los dos están en el estrato ${puesto.romano}.`
      : distancia > 0
        ? `La persona puede abordar trabajo más complejo que el que este puesto exige. El puesto pide estrato ${puesto.romano} y ella está un nivel por encima.`
        : `El puesto exige trabajo más complejo que el que la persona puede abordar hoy. El puesto pide estrato ${puesto.romano} y ella está por debajo.`;

  /**
   * Qué dice el diagrama de acá en adelante, sin dar nada por sabido.
   *
   * Lo lee alguien que no conoce el modelo: cada afirmación dice qué pasa con
   * la persona, qué pasa con el puesto, y qué habría que hacer. "El puesto le
   * queda corto" o "salvo que crezca con ella" son atajos que solo se entienden
   * sabiendo de antemano que un puesto puede sumar responsabilidades.
   */
  const adelante = (): string | null => {
    if (banda === null || edad === null) return null;

    if (distancia < 0) {
      const llega = cuandoLlega(pide);
      return llega !== null
        ? `Su capacidad sigue creciendo con los años: alrededor de los ${llega} va a poder con el trabajo que este puesto pide. Hasta entonces necesita que alguien con más alcance le divida el trabajo en partes y le fije el marco de cada una.`
        : 'Dentro de los años que muestra el diagrama, su capacidad no llega al nivel de trabajo que este puesto pide.';
    }

    if (distancia > 0) {
      return 'La diferencia se agranda con los años. Es probable que el trabajo del puesto le resulte poco exigente en poco tiempo, y para retenerla habría que sumarle responsabilidades de mayor complejidad.';
    }

    const supera = cuandoLlega(pide + 1);
    if (supera === null || !siguiente) {
      return 'Su capacidad se mantiene en este nivel dentro de los años que muestra el diagrama, así que el puesto le va a seguir quedando a medida.';
    }
    return supera <= edad + 1
      ? `Su capacidad ya está en el borde del nivel siguiente (estrato ${siguiente.romano}): en poco tiempo va a poder con trabajo más complejo que el que este puesto le da. Para que el puesto le siga sirviendo habría que ir sumándole responsabilidades de ese nivel.`
      : `Su capacidad sigue creciendo: alrededor de los ${supera} años va a poder con trabajo del nivel siguiente (estrato ${siguiente.romano}), más complejo que el que este puesto pide. Desde esa edad, para que el puesto le siga sirviendo habría que sumarle responsabilidades de ese nivel.`;
  };

  const luego = adelante();

  return (
    <dl className="os-conclusion-tiempos">
      <div>
        <dt>Hoy</dt>
        <dd>{hoy}</dd>
      </div>
      {luego && (
        <div>
          <dt>Más adelante</dt>
          <dd>{luego}</dd>
        </div>
      )}
    </dl>
  );
}
