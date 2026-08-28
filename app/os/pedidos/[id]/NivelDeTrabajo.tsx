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
  ESTRATOS,
  PREGUNTAS,
  UNIDADES,
  aDias,
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

  return (
    <div className="os-nivel-trabajo">
      {/* Contra qué se contesta, arriba de todo: las tres cosas se confunden y
          medir contra la equivocada cambia el estrato. */}
      <p className="os-nivel-alcance">
        Las dos preguntas son sobre <strong>el puesto que se va a cubrir</strong>, con las
        tareas que se le van a asignar de verdad. Lo que la persona hizo hasta hoy se
        pregunta en la entrevista, y hasta dónde puede llegar el puesto más adelante lo
        contesta el diagrama de progreso del informe.
      </p>

      {/* El time-span. La pregunta va escrita entera porque es la que la
          evaluadora le hace al cliente, palabra por palabra. */}
      <div className="os-nivel-bloque">
        <p className="os-nivel-pregunta">
          ¿Cuál es la tarea más larga que este puesto tiene que llevar hasta el final
          por sí mismo, y en cuánto tiempo se espera que esté terminada?
        </p>
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
          <span className={`os-nivel-sale${porTiempo ? '' : ' vacio'}`}>
            {porTiempo ? `Estrato ${porTiempo.romano}` : 'sin contestar'}
          </span>
        </div>
      </div>

      {/* Las cinco preguntas. Se contestan de arriba hacia abajo y el estrato es
          la más alta que sí, así que las de abajo no se borran al subir. */}
      <div className="os-nivel-bloque">
        <p className="os-nivel-pregunta">¿Qué exige el trabajo que hay que hacer?</p>
        <ol className="os-nivel-preguntas">
          {PREGUNTAS.map((p) => (
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

      {/* Lo que queda. */}
      {choca && (
        <p className="os-potencial-choca">
          El plazo da estrato {porTiempo?.romano} y las preguntas dan estrato{' '}
          {porPreguntas?.romano}. Elegí cuál rige.
        </p>
      )}

      <div className="os-nivel-cierre">
        <span className="os-etiqueta-campo">El puesto es</span>
        {choca ? (
          <Opciones
            valor={rige !== null ? String(rige) : null}
            opciones={[porTiempo, porPreguntas].filter(Boolean).map((e) => ({
              v: String(numeroDe((e as { romano: string }).romano)) as string | null,
              texto: `Estrato ${(e as { romano: string }).romano}`,
            }))}
            alElegir={(v) => elegirCual(Number(v))}
            etiqueta="Estrato del puesto"
          />
        ) : (
          <p className="os-nivel-resultado">
            {suyo ? (
              <>
                <strong>Estrato {suyo.romano}</strong>
                {suyo.mide ? ` · ${suyo.nombre}` : ` · ${suyo.grupo}`}
              </>
            ) : (
              <span className="os-tabla-flojo">sin determinar</span>
            )}
          </p>
        )}
      </div>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
