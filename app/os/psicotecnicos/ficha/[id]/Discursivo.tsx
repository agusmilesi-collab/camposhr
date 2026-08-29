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
import {
  conHuecos,
  conclusionesQueRigen,
  nivelesQueRigen,
  type CasoDeConclusion,
  type NivelDiscursivo,
} from '@/lib/discursivo';
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
  enPalabras,
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
  fundamentacion,
  subutilizado,
  estratoPuesto,
  puestoDias,
  puestoComplejidad,
  conclusiones,
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
  /** Por qué la evaluadora lo ubicó en ese estrato, con sus palabras. */
  fundamentacion?: string | null;
  /** Si el puesto que ocupa hoy no le exige lo que puede. */
  subutilizado?: boolean | null;
  /** El nivel de trabajo del puesto, contra el que se compara. */
  estratoPuesto?: number | null;
  /** De dónde sale el nivel del puesto: el plazo y las cinco preguntas. */
  puestoDias?: number | null;
  puestoComplejidad?: Record<string, boolean> | null;
  /** Las conclusiones reescritas desde Configuración, si las hay. */
  conclusiones?: Record<string, string>;
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
  const [porQueAsi, setPorQueAsi] = useState(fundamentacion ?? '');
  const [subutiliza, setSubutiliza] = useState(Boolean(subutilizado));

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

  /** Su fundamentación, al soltar el campo: se escribe de corrido. */
  async function guardarFundamentacion() {
    if (porQueAsi === (fundamentacion ?? '')) return;
    await mandar({ fundamentacion: porQueAsi.trim() || null });
  }

  /* La marca de subutilización se guarda en el momento: es un tilde, y esperar
     a que pierda el foco deja al dato sin escribir si se cambia de pestaña. */
  async function marcarSubutilizado(si: boolean) {
    setSubutiliza(si);
    if (!(await mandar({ subutilizado: si }))) setSubutiliza(!si);
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

  /* Las edades que el diagrama dibuja hacia adelante. Es el mismo filtro que
     usa el dibujo, y va acá para que la referencia nombre los puntos que están
     y no los tres de siempre. */
  const futuras = dibuja ? [40, 50, 60].filter((e) => e > edadNum + 2 && e <= EDAD_MAX) : [];

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
            desdeElPuesto={porQue(puestoDias, puestoComplejidad)}
            desdeLaPersona={porQue(diasNum, respuestas)}
          />

          {/*
            Lo único del capítulo que escribe una persona.
            El estrato sale de comparar dos números y la conclusión está redactada
            de antemano en Configuración; el instrumento mide el alcance del
            trabajo que la persona tiene asignado hoy, y eso deja afuera lo que
            ella vio en la entrevista. Va delante de la conclusión porque es lo
            que la sostiene, sale al informe con su firma y no se recalcula.
          */}
          <div className="os-potencial-fundamento">
            <span className="os-etiqueta-campo">Fundamentación de la evaluadora</span>
            <p className="os-potencial-ayuda">
              Por qué esta persona quedó en ese estrato, en primera persona. Sale en el
              informe con tu firma.
            </p>
            <textarea
              className="os-campo os-relato-campo"
              rows={4}
              maxLength={2000}
              value={porQueAsi}
              disabled={guardando}
              placeholder="Qué sostuvo en la entrevista que respalda el estrato, y qué matiza el número."
              onChange={(e) => setPorQueAsi(e.target.value)}
              onBlur={guardarFundamentacion}
            />

            <label className="os-potencial-tilde">
              {/* El tilde no se apaga mientras se guarda: se lo marca justo
                  después de soltar el campo de arriba, que es cuando hay un
                  guardado en vuelo, y apagado se comía ese clic sin avisar. */}
              <input
                type="checkbox"
                checked={subutiliza}
                onChange={(e) => marcarSubutilizado(e.target.checked)}
              />
              <span>
                <strong>El puesto que ocupa hoy no le exige lo que puede</strong>
                <small>
                  La medición toma el plazo del trabajo que tiene asignado. Marcado, el
                  informe avisa que el estrato describe a ese puesto y no al techo de la
                  persona.
                </small>
              </span>
            </label>
          </div>

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
                textos={conclusionesQueRigen(conclusiones)}
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
            {/* Qué es cada marca, como referencia y no como párrafo: son tres
                cosas distintas dibujadas y en prosa hay que buscarlas de a una.
                El globo del navegador tarda un segundo y hay que pegarle al
                punto, así que la referencia va escrita. */}
            <ul className="os-potencial-referencias">
              <li>
                <span className="os-potencial-punto hoy" aria-hidden="true" />
                Hoy, a los {edadNum} años
              </li>
              {futuras.length > 0 && (
                <li>
                  <span className="os-potencial-punto luego" aria-hidden="true" />
                  Hasta dónde llega a los{' '}
                  {futuras.length > 1
                    ? `${futuras.slice(0, -1).join(', ')} y ${futuras[futuras.length - 1]}`
                    : futuras[0]}{' '}
                  años
                </li>
              )}
              <li>
                <span className="os-potencial-punto franja" aria-hidden="true" />
                Su banda de maduración
              </li>
            </ul>
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
/** De dónde salió un nivel: el plazo contestado y la pregunta más alta que sí. */
function porQue(
  dias: number | null | undefined,
  respuestas: Record<string, boolean> | null | undefined
): string[] {
  const partes: string[] = [];
  if (dias) partes.push(`Responde por tareas de hasta ${enPalabras(dias)}`);
  const sies = Object.entries(respuestas ?? {})
    .filter(([, si]) => si)
    .map(([n]) => Number(n));
  const alta = nivelDeRespuestas(sies);
  const pregunta = alta ? PREGUNTAS.find((p) => p.estrato === alta) : null;
  if (pregunta) partes.push(`Lo más alto que exige: ${pregunta.corto.toLowerCase()}`);
  return partes;
}

function Comparacion({
  persona,
  puesto,
  banda,
  niveles,
  desdeElPuesto,
  desdeLaPersona,
}: {
  persona: { romano: string; nombre: string } | null;
  puesto: Estrato | null;
  /** Qué se contestó de cada lado, que es de donde salió su estrato. */
  desdeElPuesto: string[];
  desdeLaPersona: string[];
  /** La banda de maduración, para proyectar. Null sin edad ni horizonte. */
  banda: number | null;
  /** El catálogo, para el detalle de cada estrato. */
  niveles: { romano: string; nombre: string; procesamiento: string; que: string; horizonte: string }[];
}) {
  const detalle = (romano: string) => niveles.find((n) => n.romano === romano) ?? null;
  const numeroDe = (romano: string) => ESTRATOS.findIndex((e) => e.romano === romano);

  /**
   * Cada lado, en su tarjeta.
   *
   * Era una tabla de cinco columnas con dos renglones de texto en cada celda:
   * lo que se compara son dos números, y para encontrarlos había que recorrer
   * una grilla. En tarjetas, el estrato es lo primero de cada una y las tres se
   * leen de un vistazo, que es lo que la pantalla tiene que contestar.
   */
  const tarjeta = (
    que: string,
    romano: string | null,
    cuando: string | null,
    falta: string,
    porque: string[],
    clase: string
  ) => {
    const d = romano ? detalle(romano) : null;
    const e = romano ? ESTRATOS.find((x) => x.romano === romano) : null;
    const mecanismo = romano
      ? PREGUNTAS.find((q) => q.estrato === numeroDe(romano) + 1) ?? null
      : null;
    return (
      <article className={`os-comparacion-tarjeta ${clase}`} key={que}>
        <header>
          <span className="os-comparacion-quien">{que}</span>
          {cuando && <span className="os-comparacion-cuando">{cuando}</span>}
        </header>

        {romano ? (
          <p className="os-comparacion-estrato">
            <strong>Estrato {romano}</strong>
            <span>{d?.nombre ?? (e?.mide ? e.nombre : e?.grupo) ?? ''}</span>
          </p>
        ) : (
          <p className="os-comparacion-sin">{falta}</p>
        )}

        {mecanismo ? (
          <p className="os-comparacion-que">
            <strong>{mecanismo.corto}</strong>
            <span>{mecanismo.simple}</span>
          </p>
        ) : (
          /* El renglón se dibuja vacío igual: las tres tarjetas comparten las
             mismas filas, y salteando este hueco lo de abajo sube y las de al
             lado dejan de alinearse. */
          <p className="os-comparacion-que vacia" aria-hidden="true" />
        )}

        {/* De dónde salió ese estrato: sin esto la pantalla afirma un nivel y no
            dice qué se contestó para llegar a él, que es lo primero que pregunta
            quien no está de acuerdo. El plazo va con su rótulo porque es el que
            decide, y no un dato más. */}
        <dl className="os-comparacion-porque">
          {e && (
            <div>
              <dt>Plazo del que responde</dt>
              <dd>{plazoDe(e)}</dd>
            </div>
          )}
          {porque.map((t) => (
            <div key={t}>
              <dd>{t}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  };

  return (
    <>
      {/* Qué se está comparando, antes de las tarjetas: sin esto son tres
          números romanos sueltos. */}
      <p className="os-comparacion-intro">
        El puesto y la persona se miden con la misma escala: el nivel de complejidad del
        trabajo que cada uno alcanza, del I al VII.
      </p>
      <div className="os-comparacion-tarjetas">
        {tarjeta(
          'El puesto pide',
          puesto?.romano ?? null,
          null,
          'Sin determinar. Se contesta en la ficha del pedido.',
          desdeElPuesto,
          'puesto'
        )}
        {tarjeta(
          'La persona, hoy',
          persona?.romano ?? null,
          null,
          'Sin determinar. Se contesta en la hoja de la entrevista.',
          desdeLaPersona,
          'persona'
        )}
        {banda !== null &&
          tarjeta(
            'La persona, más adelante',
            estratoDeEscalon(horizonteEn(banda, 50)).romano,
            'a los 50 años',
            '',
            [`Por su banda de maduración, la ${banda}`],
            'futuro'
          )}
      </div>
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
  textos,
}: {
  distancia: number;
  puesto: Estrato;
  banda: number | null;
  edad: number | null;
  /**
   * Las frases que rigen, de Configuración → Potencial.
   *
   * El sistema elige cuál entra comparando los dos estratos y le llena los
   * huecos; no redacta nada. Escritas acá adentro no se podían corregir sin una
   * entrega, y son criterio de quien firma el informe.
   */
  textos: Record<CasoDeConclusion, string>;
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

  const decir = (caso: CasoDeConclusion, edadLlega?: number | null) =>
    conHuecos(textos[caso], {
      estrato: puesto.romano,
      siguiente: siguiente?.romano,
      edad: edadLlega,
    });

  const hoy =
    distancia === 0
      ? decir('hoy_alcanza')
      : distancia > 0
        ? decir('hoy_sobra')
        : decir('hoy_falta');

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
      return llega !== null ? decir('luego_falta_llega', llega) : decir('luego_falta_no_llega');
    }

    if (distancia > 0) return decir('luego_sobra');

    const supera = cuandoLlega(pide + 1);
    if (supera === null || !siguiente) return decir('luego_alcanza_estable');
    return supera <= edad + 1
      ? decir('luego_alcanza_borde')
      : decir('luego_alcanza_supera', supera);
  };

  const luego = adelante();

  /* Verde o rojo, y nada en el medio: lo que hay que contestar es si la persona
     puede con el trabajo que el puesto pide. Que además le sobre alcance es una
     advertencia sobre cuánto le va a durar el puesto, no un impedimento para
     entrar, así que también va en verde y lo explica el renglón de abajo. */
  const alcanza = distancia >= 0;

  /*
   * El veredicto arriba y solo, y debajo lo que lo explica.
   *
   * Es la única pregunta que la pantalla contesta, y estaba como una etiqueta
   * al principio de un párrafo, al mismo peso que el resto. Centrado y en
   * cuerpo grande se lee sin leer: quien abre la pestaña quiere saber eso, y el
   * detalle es para después.
   */
  return (
    <div className={`os-veredicto-bloque ${alcanza ? 'alcanza' : 'no-alcanza'}`}>
      <p className="os-veredicto-titulo">
        {alcanza ? 'Alcanza el nivel del puesto' : 'No alcanza el nivel del puesto'}
      </p>
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
    </div>
  );
}
