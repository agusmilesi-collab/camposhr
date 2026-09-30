'use client';

/**
 * El nivel de trabajo del puesto, por los dos caminos del modelo.
 *
 * Es contra qué se mide a la persona. Sin esto el informe dice en qué estrato
 * está el candidato y el cliente tiene que hacer solo la cuenta que importa,
 * que es si eso alcanza para el puesto.
 *
 * Se pregunta por dos caminos y **los dos dan el estrato solos**:
 *
 * 1. El **time-span**: el tiempo máximo de finalización de la tarea más larga
 *    que el puesto tiene que llevar hasta el final. Es la medida objetiva de
 *    Jaques, y sus cortes (tres meses, un año, dos años, cinco, diez) son los
 *    mismos que los del horizonte temporal de la persona.
 * 2. Las **cinco preguntas** de complejidad, por sí o por no. El estrato es la
 *    más alta contestada que sí.
 *
 * **Se contesta sobre la vacante y no sobre otra cosa.** El time-span es una
 * propiedad del rol, medida sobre las tareas que se le van a asignar: ni el
 * puesto que el candidato ocupa hoy, ni aquello en lo que la vacante pueda
 * convertirse más adelante. Lo primero se pregunta en la entrevista y lo
 * segundo lo contesta el diagrama de progreso.
 *
 * Van los dos porque se contestan distinto: el time-span sale de una pregunta
 * al cliente sobre plazos, y las cinco salen de qué hay que hacer en el puesto.
 * Cuando coinciden, el estrato queda firme sin que nadie decida nada. Cuando no,
 * se avisa y lo resuelve la evaluadora, que es la única decisión que queda a
 * mano en toda la pantalla.
 */

import { useEffect, useRef, useState } from 'react';
import Opciones from '@/app/os/Opciones';
import {
  AVISO_HORIZONTE,
  ESTRATOS,
  PREGUNTAS,
  UNIDADES,
  aDias,
  celdaDeSpan,
  desdeDias,
  estratoDeTimeSpan,
  estratoPorNumero,
  nivelDeRespuestas,
  type Unidad,
} from '@/lib/potencial';
import { useGuardar } from './Editar';

type Respuestas = Record<string, boolean>;

export default function NivelDeTrabajo({
  id,
  timeSpanDias,
  complejidad,
  estratoPuesto,
}: {
  id: string;
  timeSpanDias: number | null;
  complejidad: Respuestas | null;
  estratoPuesto: number | null;
}) {
  const { guardar, error } = useGuardar(id);

  const inicial = timeSpanDias ? desdeDias(timeSpanDias) : null;
  const [cuanto, setCuanto] = useState(inicial ? String(inicial.cantidad) : '');
  const [unidad, setUnidad] = useState<Unidad>(inicial?.unidad ?? 'meses');
  const [respuestas, setRespuestas] = useState<Respuestas>(complejidad ?? {});
  const [rige, setRige] = useState<number | null>(estratoPuesto);

  const dias = aDias(Number(cuanto.replace(',', '.')), unidad);
  const porTiempo = dias !== null ? estratoDeTimeSpan(dias) : null;
  const porPreguntas = estratoPorNumero(
    nivelDeRespuestas(
      Object.entries(respuestas)
        .filter(([, si]) => si)
        .map(([n]) => Number(n))
    ) ?? 0
  );

  /**
   * El estrato que queda, y lo que hay que hacer con él.
   *
   * Con los dos caminos de acuerdo, o con uno solo contestado, se guarda solo.
   * Con los dos en desacuerdo no se elige por la evaluadora: se le muestran los
   * dos y ella dice cuál rige.
   */
  const solos =
    porTiempo && porPreguntas
      ? porTiempo.romano === porPreguntas.romano
        ? porTiempo
        : null
      : (porTiempo ?? porPreguntas);
  const choca = Boolean(porTiempo && porPreguntas && !solos);
  /** Sin ninguno de los dos contestados, lo pone la evaluadora a mano. */
  const aMano = !porTiempo && !porPreguntas;
  const numeroDe = (r: string) => ESTRATOS.findIndex((e) => e.romano === r) + 1;

  async function guardarTiempo(cantidad: string, u: Unidad) {
    const limpio = cantidad.trim();
    const n = limpio ? aDias(Number(limpio.replace(',', '.')), u) : null;
    if (limpio && n === null) return;
    await guardar('time_span_dias', n);
  }

  /*
   * Las respuestas se acumulan sobre la referencia y no sobre el estado.
   *
   * Contestar cinco preguntas seguidas son cinco guardados en vuelo, y cada
   * manejador se lleva el estado que había cuando se dibujó: con el estado a
   * secas, la quinta respuesta pisaba a las cuatro anteriores.
   */
  const vivas = useRef(respuestas);

  async function contestar(estrato: number, si: boolean | null) {
    const nuevas = { ...vivas.current };
    if (si === null) delete nuevas[String(estrato)];
    else nuevas[String(estrato)] = si;
    vivas.current = nuevas;
    setRespuestas(nuevas);
    await guardar('complejidad', Object.keys(nuevas).length > 0 ? nuevas : null);
  }

  /*
   * El estrato que rige se guarda solo cuando los dos caminos coinciden.
   *
   * Va en un efecto y no adentro de cada manejador: es una consecuencia de lo
   * que se contestó, y calcularlo en cada uno obligaba a arrastrar los valores
   * nuevos a mano por dos caminos distintos.
   */
  const solosRomano = solos?.romano ?? null;
  useEffect(() => {
    if (choca) return;
    const n = solosRomano ? numeroDe(solosRomano) : null;
    if (n === rige) return;
    setRige(n);
    guardar('estrato_puesto', n);
    // `guardar` se rehace en cada dibujo, así que no entra en las dependencias:
    // lo que dispara esto es el estrato que salió, no la función.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solosRomano, choca]);

  async function elegirCual(n: number) {
    setRige(n);
    await guardar('estrato_puesto', n);
  }

  const suyo = rige ? estratoPorNumero(rige) : null;
  /* La celda del puesto sale del plazo y no de un juicio: es como Jaques
     gradúa un rol, midiendo la tarea más larga y viendo en qué tercio del
     estrato cae. Sólo cuando el plazo está cargado y cae en el estrato que
     rige; si el estrato lo pusieron las preguntas o la evaluadora, el plazo no
     lo confirma y graduar sería inventar. */
  const celdaDelPuesto =
    dias !== null && suyo && porTiempo?.romano === suyo.romano ? celdaDeSpan(dias) : null;

  return (
    <div className="os-nivel-trabajo">

      {/* El time-span. La pregunta va escrita entera porque es la que la
          evaluadora le hace al cliente, palabra por palabra. */}
      {/* En cuatro columnas: la pregunta con sus avisos ocupa dos, el plazo
          una y lo que da la cuarta, cada uno en su tarjeta. */}
      <div className="os-nivel-card os-plazo-fila">
        <section className="os-nivel-mini os-plazo-pregunta">
          <p className="os-nivel-pregunta">
            ¿Cuál es la tarea de mayor alcance temporal de la que responde este puesto, y
            cuándo se sabe si su resultado salió bien?
          </p>
          {/* La confusión que arruina la medición: el plazo del resultado contra
              las horas de trabajo que cuesta producirlo. */}
          <p className="os-nivel-aviso">{AVISO_HORIZONTE}</p>
          {/* En el método el plazo lo fija quien asigna la tarea: es su
              expectativa y no lo que el puesto dice de sí mismo. */}
          <p className="os-nivel-aviso">
            Se contesta con lo que dice el jefe directo: qué tarea le asigna y para cuándo
            espera el resultado.
          </p>
        </section>

        <section className="os-nivel-mini os-plazo-dato">
          <span className="os-etiqueta-campo">Plazo</span>
          <div className="os-nivel-tiempo">
            <input
              className="os-control-suave os-potencial-numero"
              inputMode="decimal"
              value={cuanto}
              placeholder="0"
              onChange={(e) => setCuanto(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))}
              onBlur={() => guardarTiempo(cuanto, unidad)}
            />
            <select
              className="os-control-suave"
              value={unidad}
              onChange={(e) => {
                const u = e.target.value as Unidad;
                setUnidad(u);
                guardarTiempo(cuanto, u);
              }}
            >
              {UNIDADES.map((u) => (
                <option key={u.clave} value={u.clave}>
                  {u.texto}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="os-nivel-mini os-plazo-dato">
          <span className="os-etiqueta-campo">Resultado</span>
          {porTiempo ? (
            <strong className="os-nivel-mini-dato os-plazo-estrato">
              Estrato {porTiempo.romano}
            </strong>
          ) : (
            <span className="os-tabla-flojo">sin contestar</span>
          )}
        </section>
      </div>

      {/* Las cinco preguntas. Se contestan de arriba hacia abajo y el estrato es
          la más alta que sí, así que las de abajo no se borran al subir. */}
      <div className="os-nivel-bloque os-nivel-card">
        <p className="os-nivel-pregunta">
          ¿Qué exige el trabajo? El estrato es la pregunta más alta que da Sí.
        </p>
        {/* Contestadas de memoria, casi todas dan que sí: cualquier jefatura
            dice que planifica con alternativas. El ejemplo es lo que separa el
            dato de la impresión. */}
        <p className="os-nivel-aviso">
          Antes de marcar Sí, pedí un ejemplo concreto de esa exigencia en este puesto.
        </p>
        <ol className="os-nivel-preguntas os-preguntas-pedido">
          {PREGUNTAS.map((p) => (
            <li key={p.estrato}>
              <span className="os-nivel-texto">
                <strong className="os-pregunta-estrato">
                  <span className="os-nivel-numero os-numero-oscuro">{p.estrato}</span>
                  {p.corto}
                </strong>
                <small>{p.texto}</small>
                <small className="os-pregunta-ejemplo">Por ejemplo: {p.ejemplo}</small>
              </span>
              {/* El estrato arriba del sí y el no: el nivel es la más alta que
                  sí, y así se lee cuál da sin saberse el orden de memoria. */}
              <div className="os-pregunta-respuesta">
                <span className="os-pregunta-romano">
                  Estrato {estratoPorNumero(p.estrato)?.romano}
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
              </div>
            </li>
          ))}
        </ol>
        <Resultado estrato={porPreguntas?.romano ?? null} />
      </div>

      {/* Lo que queda. */}
      {choca && (
        <p className="os-potencial-choca">
          El plazo da estrato {porTiempo?.romano} y las preguntas dan estrato{' '}
          {porPreguntas?.romano}. Elegí cuál rige.
        </p>
      )}

      {/* Tres tarjetas en fila: qué es el puesto, de dónde sale y si el otro
          camino lo confirma. El plazo es la medida del método y las preguntas
          son el control. */}
      <div className="os-nivel-cierre os-nivel-card">
        <div className="os-nivel-cierre-fila">
          <section className="os-nivel-mini">
            <span className="os-etiqueta-campo">
              {aMano ? 'O elegilo a mano' : 'El puesto es'}
            </span>
            {aMano ? (
              /* Sin las dos preguntas contestadas, la evaluadora lo pone: hay
                 pedidos que llegan con el nivel acordado de antes, y obligarla a
                 inventar un plazo para que el sistema lo deduzca sería peor. */
              <Opciones
                valor={rige !== null ? String(rige) : null}
                opciones={ESTRATOS.slice(0, 5).map((e, i) => ({
                  v: String(i + 1) as string | null,
                  texto: e.romano,
                }))}
                alElegir={(v) => elegirCual(Number(v))}
                etiqueta="Estrato del puesto"
              />
            ) : choca ? (
              <Opciones
                valor={rige !== null ? String(rige) : null}
                opciones={[porTiempo, porPreguntas].filter(Boolean).map((e) => ({
                  v: String(numeroDe((e as { romano: string }).romano)) as string | null,
                  texto: `Estrato ${(e as { romano: string }).romano}`,
                }))}
                alElegir={(v) => elegirCual(Number(v))}
                etiqueta="Estrato del puesto"
              />
            ) : suyo ? (
              <>
                <strong className="os-nivel-mini-dato">
                  Estrato {suyo.romano}
                  {celdaDelPuesto ? ` · celda ${celdaDelPuesto}` : ''}
                </strong>
                <span className="os-nivel-mini-nota">
                  {suyo.mide ? suyo.nombre : suyo.grupo}
                </span>
              </>
            ) : (
              <span className="os-tabla-flojo">sin determinar</span>
            )}
          </section>

          {!aMano && (
            <>
              <section className="os-nivel-mini">
                <span className="os-etiqueta-campo">Input</span>
                {/* Tal como se cargó: pasado a palabras, 18 meses se leía
                    "un año y medio" y parecía otro dato. */}
                <strong className="os-nivel-mini-dato">
                  {porTiempo && dias !== null
                    ? `Plazo de ${cuanto.trim()} ${UNIDADES.find((u) => u.clave === unidad)?.texto ?? ''}`
                    : 'Las preguntas'}
                </strong>
                <span className="os-nivel-mini-nota">
                  {porTiempo ? `Da estrato ${porTiempo.romano}` : 'Sin plazo cargado'}
                </span>
              </section>

              <section className="os-nivel-mini">
                <span className="os-etiqueta-campo">Preguntas</span>
                {porPreguntas ? (
                  <strong className="os-nivel-mini-dato">Estrato {porPreguntas.romano}</strong>
                ) : (
                  <span className="os-tabla-flojo">sin contestar</span>
                )}
                {porPreguntas && porTiempo && (
                  <span className={`os-sello-estado ${choca ? 'os-rojo' : 'os-verde'}`}>
                    {choca ? 'No coinciden con el plazo' : 'Coinciden con el plazo'}
                  </span>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}

/** El pie de cada tarjeta: qué estrato da ese camino. */
function Resultado({ estrato }: { estrato: string | null }) {
  return (
    <div className="os-nivel-card-pie">
      <span className="os-etiqueta-campo">Resultado</span>
      <span className={`os-nivel-sale${estrato ? '' : ' vacio'}`}>
        {estrato ? `Estrato ${estrato}` : 'sin contestar'}
      </span>
    </div>
  );
}
