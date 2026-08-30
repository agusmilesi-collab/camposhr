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
import { createPortal } from 'react-dom';
import Opciones from '@/app/os/Opciones';
import { nivelesQueRigen } from '@/lib/discursivo';
import type { Estrato } from '@/lib/potencial';
import {
  APERTURA,
  EDAD_MAX,
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
  plazoDe,
  diasParaElDiagrama,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  CELDAS,
  esCelda,
  esModo,
  estratoDeDiscurso,
  MODOS,
  type CeldaDelEstrato,
  PEDIDO_DISCURSO,
  REPREGUNTAS_PLAZO,
  type ModoDeDiscurso,
  type Unidad,
} from '@/lib/potencial';
import Progreso from '../../informe/_doc/Progreso';
import AudioDiscurso from './AudioDiscurso';

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
  discursoModo,
  discursoAbstracto,
  discursoCelda,
  audioNombre,
  audioBytes,
  audioEnlace,
  pedidoId,
  estratoPuesto,
  puestoDias,
  puestoComplejidad,
  nombre,
  fecha,
  empresa,
  solicitante,
  puesto: elPuesto,
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
  /** Cómo ordena lo que dice, leído en los cinco minutos de discurso libre. */
  discursoModo?: string | null;
  /** Ese modo, sobre conceptos en vez de cosas concretas. */
  discursoAbstracto?: boolean | null;
  /** Dónde cae dentro de su estrato: A, B o C. */
  discursoCelda?: string | null;
  /** La grabación de los cinco minutos, si ya se subió. */
  audioNombre?: string | null;
  audioBytes?: number | null;
  /** El enlace firmado para escucharla. */
  audioEnlace?: string | null;
  /** El pedido, para poder abrirlo desde la tarjeta del puesto. */
  pedidoId?: string | null;
  /** El nivel de trabajo del puesto, contra el que se compara. */
  estratoPuesto?: number | null;
  /** De dónde sale el nivel del puesto: el plazo y las cinco preguntas. */
  puestoDias?: number | null;
  puestoComplejidad?: Record<string, boolean> | null;
  /** De quién es, para que el PDF del diagrama diga a quién describe. */
  nombre?: string | null;
  /** Cuándo se la evaluó, para el encabezado de ese PDF. */
  fecha?: string | null;
  /** Para quién se la evaluó: empresa, quién la pidió y para qué pedido. */
  empresa?: string | null;
  solicitante?: string | null;
  puesto?: string | null;
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
  const [suModo, setSuModo] = useState<ModoDeDiscurso | null>(
    esModo(discursoModo) ? discursoModo : null
  );
  const [abstracto, setAbstracto] = useState(Boolean(discursoAbstracto));
  const [celda, setCelda] = useState<CeldaDelEstrato>(
    esCelda(discursoCelda) ? discursoCelda : 'M'
  );
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

  /** Lo que contó, al soltar el campo: se escribe de a ratos mientras habla. */
  async function guardarRelato() {
    if (contado === (relato ?? '')) return;
    await mandar({ relato: contado.trim() || null });
  }

  const [imprimiendo, setImprimiendo] = useState(false);

  /*
   * Imprimir cuando la hoja ya está en la pantalla.
   *
   * `window.print` congela lo que hay dibujado en ese momento, así que llamarlo
   * en el mismo clic que pide la hoja imprime la pantalla sin ella. El efecto
   * corre después del dibujo, y `afterprint` saca la hoja haya guardado el PDF
   * o haya cancelado.
   */
  useEffect(() => {
    if (!imprimiendo) return;
    document.body.dataset.imprimir = 'diagrama';
    /* El navegador le pone al archivo el título del documento, que es el de la
       pantalla y sale "Campos OS.pdf" para todos. Se cambia mientras dura la
       impresión y se repone después. */
    const titulo = document.title;
    document.title = apellidoDe(nombre) ? `${apellidoDe(nombre)} potencial` : 'potencial';
    const fin = () => setImprimiendo(false);
    window.addEventListener('afterprint', fin);
    const cuadro = requestAnimationFrame(() => window.print());
    return () => {
      document.title = titulo;
      delete document.body.dataset.imprimir;
      window.removeEventListener('afterprint', fin);
      cancelAnimationFrame(cuadro);
    };
  }, [imprimiendo, nombre]);

  /**
   * El modo del discurso, que es de donde sale el estrato de la persona.
   *
   * Se elige escuchando la grabación, así que se guarda en el momento: volver a
   * apretar el que ya estaba lo desmarca, que es la forma de corregir sin
   * elegir otro que no corresponde.
   */
  async function elegirModo(m: ModoDeDiscurso | null) {
    const antes = suModo;
    setSuModo(m);
    /* Sacar el modo saca el estrato: sin discurso codificado la persona no
       tiene nivel, y dejar el anterior guardado haría que el informe siguiera
       concluyendo sobre un número que ya nadie sostiene. */
    if (m === null) setPuesto(null);
    if (!(await mandar(m === null ? { discursoModo: null, nivel: null } : { discursoModo: m }))) {
      setSuModo(antes);
    }
  }

  async function marcarAbstracto(si: boolean) {
    setAbstracto(si);
    if (!(await mandar({ discursoAbstracto: si }))) setAbstracto(!si);
  }

  async function elegirCelda(c: CeldaDelEstrato) {
    const antes = celda;
    setCelda(c);
    if (!(await mandar({ discursoCelda: c }))) setCelda(antes);
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

  /* El estrato que da el plazo del trabajo asignado: se muestra al lado del
     campo, en la hoja de la entrevista, para saber qué salió de lo que se
     acaba de contestar. No es el estrato de la persona. */
  const porHorizonte = diasNum !== null ? estratoDeEscalon(escalonDe(diasNum)) : null;
  /**
   * El estrato de la persona, que sale del discurso y de nada más.
   *
   * Lo que se contestó en la entrevista, el plazo y las cuatro preguntas, mide
   * el trabajo que le asignaron: es hasta dónde la dejaron llegar, y guardarlo
   * como su nivel hacía que el informe concluyera sobre eso. La capacidad se
   * lee en cómo ordena lo que dice, que es la vía del modelo.
   */
  const numeroDelDiscurso = estratoDeDiscurso(suModo, abstracto);
  const porDiscurso = numeroDelDiscurso ? estratoPorNumero(numeroDelDiscurso) : null;
  const rige = porDiscurso;
  /**
   * Con qué horizonte se dibuja el punto en el diagrama.
   *
   * El diagrama ubica a la persona por su edad y su horizonte, y el horizonte
   * que corresponde es el de su capacidad. Con el discurso codificado, esa
   * capacidad es un estrato y no un número de días: se dibuja en el medio de la
   * franja de ese estrato, que es el punto que no queda apoyado sobre ninguna
   * de sus dos rayas.
   *
   * Si el plazo que se le midió en el trabajo cae dentro de ese mismo estrato,
   * manda el plazo medido, que es más preciso que el medio de la franja.
   */
  const diasDelPunto = diasParaElDiagrama(porDiscurso, diasNum, celda);

  const dibuja =
    Number.isFinite(edadNum) && edadNum >= 16 && edadNum <= 80 && diasDelPunto !== null;
  const banda = dibuja ? bandaDe(edadNum, diasDelPunto as number) : null;

  /* Las edades que el diagrama dibuja hacia adelante. Es el mismo filtro que
     usa el dibujo, y va acá para que la referencia nombre los puntos que están
     y no los tres de siempre. */
  const futuras = dibuja ? [40, 50, 60].filter((e) => e > edadNum + 2 && e <= EDAD_MAX) : [];


  /**
   * Si el potencial está tomado: los cuatro pasos.
   *
   * El plazo, las cuatro preguntas y la grabación de los cinco minutos. Sin la
   * grabación el estrato de la persona no se puede codificar, así que la hoja
   * no está terminada aunque lo demás esté completo.
   *
   * Se calcula acá y no en el servidor: la pastilla tiene que cambiar en el
   * momento en que se marca la última respuesta, y esperando al redibujo del
   * servidor quedaba un segundo diciendo lo contrario de lo que se ve.
   */
  const tomado =
    diasNum !== null &&
    [1, 2, 3, 4].every((n) => typeof respuestas[String(n)] === 'boolean') &&
    Boolean(audioNombre);

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

  /* El nivel se fija solo con lo que dio el discurso. */
  const salio = rige?.romano ?? null;
  useEffect(() => {
    if (!salio) return;
    const nombre = nombreDe(salio);
    if (nombre === puesto) return;
    setPuesto(nombre);
    mandar({ nivel: nombre });
    // Lo que dispara esto es el estrato que salió, no las funciones de guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salio]);

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
          {/* Los dos tramos de la hoja, que miden cosas distintas y no se
              mezclan: los tres primeros pasos son sobre el trabajo que la
              persona tiene hoy, y el cuarto es sobre ella. */}
          <div className="os-tramo">
            <h5>Pasos 1 a 3 · Sobre el trabajo que tiene hoy</h5>
          </div>
      {/* Los pasos 1 y 2 van uno al lado del otro: son la misma pregunta en dos
          partes, qué tarea y en cuánto se sabe si salió bien, y apilados se
          llevaban media pantalla para dos campos. */}
      <div className="os-pasos-dos">
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
        {/* Lo que hay que repreguntar para que el plazo sea un dato y no una
            impresión: un plazo dicho de memoria se estira, y estas cuatro lo
            convierten en una fecha, un nombre y una decisión. */}
        {enEntrevista && (
          <ul className="os-repreguntas">
            {REPREGUNTAS_PLAZO.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
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
      </div>

      {/* Las preguntas van sobre las asignaciones que manejó al límite de lo que
          pudo, no sobre lo que sabe hacer: es lo que el libro indica pedir. */}
      <div className="os-nivel-bloque">
        <p className="os-nivel-pregunta">
          {enEntrevista && <span className="os-nivel-numero">3</span>}
          {enEntrevista
            ? 'Sobre esa tarea, ¿qué le exige?'
            : 'Tomando las dos o tres asignaciones que manejó al límite de lo que pudo, ¿qué le exigieron?'}
        </p>
        {/* En la entrevista van en dos columnas, con el sí y el no arriba a la
            derecha de cada una: son cuatro y en una sola columna se llevaban
            media pantalla. */}
        <ol className={`os-nivel-preguntas${enEntrevista ? ' os-preguntas-dos' : ''}`}>
          {PREGUNTAS.filter((p) => p.estrato <= 4).map((p) => (
            <li key={p.estrato}>
              <span className="os-nivel-texto">
                <strong>{p.corto}</strong>
                {/* En la entrevista, la pregunta tal como se le hace a la
                    persona; codificando, la que describe el trabajo. */}
                <small>{enEntrevista ? p.alCandidato : p.texto}</small>
                {/* Y las repreguntas: contestar que sí es fácil, y estas dos
                    piden lo que solo puede describir quien lo hizo. */}
                {enEntrevista && (
                  <ul className="os-repreguntas">
                    {p.repreguntas.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </span>
              <Opciones
                // En la entrevista, uno arriba del otro: son dos palabras
                // cortas y en fila se llevaban un tercio de la tarjeta.
                apilada={enEntrevista}
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

        <div className="os-tramo">
          <h5>Paso 4 · Análisis discursivo</h5>
        </div>

        {/* Los cinco minutos de discurso libre, que es la otra vía del modelo.
            Acá solo se pide y se graba: lo que se escucha se codifica después,
            en la pestaña Potencial, y de ahí sale el estrato de la persona. Lo
            de arriba mide el trabajo que le asignaron, que es otra cosa. */}
        <div className="os-nivel-bloque os-paso-audio">
          <p className="os-nivel-pregunta">
            <span className="os-nivel-numero">4</span>
            {PEDIDO_DISCURSO}
          </p>
          <AudioDiscurso
            id={id}
            persona={nombre}
            nombre={audioNombre ?? null}
            bytes={audioBytes ?? null}
            enlace={audioEnlace ?? null}
            puedeGrabar
          />
        </div>

        </>
      ) : (
        /* Codificando, las preguntas ya están contestadas en la entrevista: lo
           que hace falta acá es la comparación, que es lo que decide. */
        <>
          {/* Lo único que se compara desde acá es lo que el puesto pide: lo de
              la persona se lee en la tarjeta de abajo y en el diagrama. */}
          <Comparacion
            puesto={estratoPuesto ? estratoPorNumero(estratoPuesto) : null}
            desdeElPuesto={porQue(puestoDias, puestoComplejidad)}
            preguntasDelPuesto={marcadas(PREGUNTAS, puestoComplejidad)}
            pedidoId={pedidoId ?? null}
          />

          {/*
            Lo que decide la evaluadora.

            La conclusión del sistema salió de la pantalla: comparaba el puesto
            contra el estrato de la persona y solo tiene sentido con el discurso
            codificado, que es lo que se hace acá mismo. Lo que se concluye se
            lee en el informe.
          */}
          <div className="os-potencial-cierre">
            <section className="os-cierre-tarjeta os-cierre-psico">
              <span className="os-etiqueta-campo">Lo que decide la evaluadora</span>
              {/* El plazo y las cuatro preguntas no se repiten acá: se
                  contestan en la hoja de la entrevista, mientras la persona
                  habla, y lo que se contestó se ve en la tarjeta de arriba. */}

              {/* La grabación, para escucharla: subirla es de la hoja de la
                  entrevista, que es donde se toma. */}
              <div className="os-evaluadora-audio">
                <AudioDiscurso
                  id={id}
                  nombre={audioNombre ?? null}
                  bytes={audioBytes ?? null}
                  enlace={audioEnlace ?? null}
                  puedeCambiar={false}
                />
              </div>

              {/* Los cuatro modos, en fila: de acá sale el estrato. */}
              <div className="os-discurso">
                <span className="os-etiqueta-campo">Cómo ordenó lo que dijo</span>
                <ol
                  className="os-estratos-elegir os-modos-fila"
                  role="radiogroup"
                  aria-label="Modo de procesamiento"
                >
                  {MODOS.map((m) => {
                    const suyo = suModo === m.clave;
                    const suEstrato = estratoPorNumero(m.estrato + (abstracto ? 4 : 0));
                    return (
                      <li key={m.clave}>
                        <button
                          type="button"
                          role="radio"
                          className={`os-estrato-opcion${suyo ? ' suyo' : ''}`}
                          disabled={guardando}
                          aria-checked={suyo}
                          // Volver a apretar el que ya estaba lo desmarca.
                          onClick={() => elegirModo(suyo ? null : m.clave)}
                        >
                          <span className="os-estrato-marca" aria-hidden="true" />
                          <span className="os-estrato-texto">
                            {/* Primero el estrato, que es el dato con el que se
                                compara, y después cómo se llama ese modo. */}
                            <span className="os-estrato-titulo">
                              <strong>Estrato {suEstrato?.romano ?? ''}</strong>
                              <span className="os-modo-nombre">{m.nombre}</span>
                            </span>
                            <small>{m.suena}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/*
                Las tres precisiones del método sobre esa lectura, cada una en
                su tarjeta y con el nombre que le da el modelo: en qué orden de
                complejidad procesa, en qué celda del estrato cae, y qué relación
                hay entre lo que puede y lo que el puesto le deja usar.
              */}
              <span className="os-etiqueta-campo">Capacidad potencial y aplicada</span>
              <div className="os-evaluadora-marcas">
                <div className="os-precision">
                  <span className="os-precision-que">Orden de complejidad</span>
                  <label className="os-potencial-tilde">
                    <input
                      type="checkbox"
                      checked={abstracto}
                      onChange={(e) => marcarAbstracto(e.target.checked)}
                    />
                    <span>
                      <strong>Conceptual abstracto</strong>
                    </span>
                  </label>
                  <small>
                    Habla sobre conceptos y no sobre cosas concretas. Los cuatro modos se
                    repiten en cada orden, así que el mismo modo corre cuatro estratos.
                  </small>
                </div>

                <div className="os-precision">
                  <span className="os-precision-que">Celda del estrato</span>
                  <div className="os-celdas">
                    {CELDAS.map((c) => (
                      <button
                        key={c.clave}
                        type="button"
                        className={`os-celda${celda === c.clave ? ' suya' : ''}`}
                        disabled={guardando}
                        aria-pressed={celda === c.clave}
                        title={c.dice}
                        onClick={() => elegirCelda(c.clave)}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                  <small>
                    Cada estrato se divide en tres, como los rótulos de la lámina: B bajo,
                    recién entrando; M medio, sostenido; A alto, a punto de pasar al
                    siguiente.
                  </small>
                </div>

                <div className="os-precision">
                  <span className="os-precision-que">Capacidad aplicada</span>
                  <label className="os-potencial-tilde">
                    <input
                      type="checkbox"
                      checked={subutiliza}
                      onChange={(e) => marcarSubutilizado(e.target.checked)}
                    />
                    <span>
                      <strong>Puede más que lo que el puesto actual le exige</strong>
                    </span>
                  </label>
                  <small>
                    El estrato dice lo que puede. El trabajo que tiene asignado puede estar
                    por debajo, y entonces el informe lo aclara.
                  </small>
                </div>
              </div>

              {/* Y al pie, lo que escribe: es lo último que se hace, con todo lo
                  de arriba resuelto. */}
              <div className="os-potencial-fundamento">
                <span className="os-etiqueta-campo">Fundamentación</span>
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
              </div>

          {/*
            Con qué se dibuja el punto, escrito.
            El diagrama es una lámina con curvas y a simple vista no se sabe qué
            dato lo movió. Son tres, y cada uno se carga en otro lado: la edad en
            la hoja de la entrevista, el modo escuchando la grabación, y el plazo
            del trabajo también en la entrevista.
          */}
          <span className="os-etiqueta-campo os-potencial-entradas-titulo">
            Inputs del diagrama
          </span>
          <ol className="os-potencial-entradas">
            <li title="De la fecha de nacimiento, en la hoja de la entrevista">
              <span className="os-potencial-entrada-que">Edad</span>
              <span className="os-potencial-entrada-valor">
                {Number.isFinite(edadNum) && edadNum > 0 ? `${edadNum} años` : 'Falta'}
              </span>
            </li>
            <li
              title={
                porDiscurso
                  ? `El punto va en la celda ${celda} de ese estrato${
                      diasDelPunto ? `, ${enPalabras(diasDelPunto)}` : ''
                    }`
                  : 'Se elige escuchando la grabación, acá arriba'
              }
            >
              <span className="os-potencial-entrada-que">Análisis del discurso</span>
              <span className="os-potencial-entrada-valor">
                {porDiscurso
                  ? `Estrato ${porDiscurso.romano} · ${
                      MODOS.find((m) => m.clave === suModo)?.nombre ?? ''
                    }${abstracto ? ' sobre conceptos' : ''} · celda ${celda}`
                  : 'Sin codificar'}
              </span>
            </li>
            <li
              title={
                porDiscurso
                  ? 'Es el cuadradito gris, y no mueve la banda'
                  : 'Sin discurso codificado, es lo que ubica el punto azul'
              }
            >
              <span className="os-potencial-entrada-que">Plazo del trabajo actual</span>
              <span className="os-potencial-entrada-valor">
                {diasNum ? enPalabras(diasNum) : 'Falta'}
              </span>
            </li>
          </ol>
            </section>
          </div>
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
        <div className="os-potencial-cabeza">
          <span className="os-etiqueta-campo">Diagrama de progreso potencial</span>
          {dibuja && (
            <button
              type="button"
              className="os-boton"
              onClick={() => setImprimiendo(true)}
            >
              Descargar PDF
            </button>
          )}
        </div>

        {dibuja ? (
          <div className="os-potencial-grafico">
            <Progreso
              edad={edadNum}
              dias={diasDelPunto as number}
              diasAplicado={porDiscurso ? diasNum : null}
            />
            {/* Qué es cada marca, como referencia y no como párrafo: son tres
                cosas distintas dibujadas y en prosa hay que buscarlas de a una.
                El globo del navegador tarda un segundo y hay que pegarle al
                punto, así que la referencia va escrita. */}
            <Referencias
              edad={edadNum}
              futuras={futuras}
              aplicado={Boolean(porDiscurso && diasNum)}
            />
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

      {/* La hoja del PDF, colgada del body y no de la pantalla.
          Imprimir apagando lo que está alrededor deja las hojas en blanco que
          ese contenido apagado sigue ocupando; una copia suelta al lado de la
          aplicación se imprime sola, en una hoja y apaisada. */}
      {imprimiendo &&
        dibuja &&
        createPortal(
          <div className="os-papel-diagrama">
            {/* La marca, la misma del informe: el PDF sale del sistema y se
                manda al cliente, así que se presenta como lo que es. */}
            <header className="os-papel-marca">
              <span>
                <span className="os-papel-nombre">Campos HR</span>
                <span>Evaluaciones psicotécnicas</span>
              </span>
              <span className="os-papel-sitio">www.camposhr.com</span>
            </header>

            {/* De quién es y de cuándo: el PDF se manda o se archiva fuera del
                sistema, y ahí un diagrama suelto no dice nada por sí solo. */}
            <p className="os-papel-titulo">Diagrama de progreso potencial</p>
            <dl className="os-papel-datos">
              {[
                { rotulo: 'Nombre', valor: nombre },
                { rotulo: 'Fecha de evaluación', valor: fecha },
                { rotulo: 'Empresa', valor: empresa },
                { rotulo: 'Solicitado por', valor: solicitante },
                { rotulo: 'Pedido', valor: elPuesto },
              ]
                .filter((d) => d.valor)
                .map((d) => (
                  <div key={d.rotulo}>
                    <dt>{d.rotulo}</dt>
                    <dd>{d.valor}</dd>
                  </div>
                ))}
            </dl>
            <Progreso
              edad={edadNum}
              dias={diasDelPunto as number}
              diasAplicado={porDiscurso ? diasNum : null}
            />
            <Referencias edad={edadNum} futuras={futuras} aplicado={Boolean(porDiscurso && diasNum)} />
          </div>,
          document.body
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
/**
 * El apellido, que es la última palabra del nombre completo.
 *
 * Es para nombrar el archivo que se descarga, y ahí lo que se busca es el
 * apellido. Con nombres compuestos ("Mauro Lionel Lambhert") la última palabra
 * es la que sirve.
 */
function apellidoDe(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return partes.length ? partes[partes.length - 1].toLowerCase() : '';
}

/**
 * Qué es cada marca del diagrama.
 *
 * Va aparte porque se dibuja dos veces: debajo del diagrama en pantalla y otra
 * vez en la hoja que se imprime, que es una copia del dibujo sin la pantalla
 * alrededor.
 */
function Referencias({
  edad,
  futuras,
  aplicado = false,
}: {
  edad: number;
  futuras: number[];
  /** Si el dibujo trae también el plazo del trabajo que tiene asignado. */
  aplicado?: boolean;
}) {
  return (
    <ul className="os-potencial-referencias">
      <li>
        <span className="os-potencial-punto hoy" aria-hidden="true" />
        Lo que puede hoy, a los {edad} años
      </li>
      {aplicado && (
        <li>
          <span className="os-potencial-punto puesto" aria-hidden="true" />
          Lo que le pide su puesto de hoy
        </li>
      )}
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
  );
}

/** Cada pregunta con lo que se marcó: sí, no, o sin contestar. */
function marcadas(
  preguntas: readonly { estrato: number; corto: string }[],
  respuestas: Record<string, boolean> | null | undefined
): { corto: string; si: boolean | null }[] {
  return preguntas.map((p) => ({
    corto: p.corto,
    si: typeof respuestas?.[String(p.estrato)] === 'boolean' ? respuestas[String(p.estrato)] : null,
  }));
}

/** De dónde salió un nivel: el plazo contestado y la pregunta más alta que sí. */
function porQue(
  dias: number | null | undefined,
  respuestas: Record<string, boolean> | null | undefined
): string[] {
  const partes: string[] = [];
  if (dias) partes.push(`Hasta ${enPalabras(dias)}`);
  // Cuál es la más alta contestada que sí se lee en la lista de preguntas de la
  // tarjeta, que las muestra a las cinco con lo que se marcó en cada una.
  void respuestas;
  return partes;
}

function Comparacion({
  puesto,
  desdeElPuesto,
  preguntasDelPuesto,
  pedidoId,
}: {
  puesto: Estrato | null;
  /** El plazo con el que se contestó, que es de donde salió su estrato. */
  desdeElPuesto: string[];
  /** Las cinco preguntas de complejidad con lo que se marcó en cada una. */
  preguntasDelPuesto: { corto: string; si: boolean | null }[];
  /** El pedido de donde salen estos datos, para ir a corregirlos. */
  pedidoId: string | null;
}) {
  return (
    <div className="os-comparacion-tarjetas">
      <article className="os-comparacion-tarjeta puesto">
        <header>
          <span className="os-comparacion-quien">El puesto al que aspira requiere</span>
          {/* Todo esto se contesta en el pedido, así que el camino para
              corregirlo va acá y no en la cabecera de la pestaña. */}
          {pedidoId && (
            <a
              className="os-comparacion-ir"
              href={`/os/pedidos/${pedidoId}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir el pedido
            </a>
          )}
        </header>

        {/* En dos columnas: el estrato con su plazo a la izquierda y las cinco
            marcas a la derecha. Apilado, lo mismo ocupaba el doble de alto. */}
        <div className="os-puesto-cuerpo">
          <div>
            {puesto ? (
              <p className="os-comparacion-estrato">
                <strong>Estrato {puesto.romano}</strong>
                <span>{puesto.mide ? puesto.nombre : puesto.grupo}</span>
              </p>
            ) : (
              <p className="os-comparacion-sin">
                Sin determinar. Se contesta en la ficha del pedido.
              </p>
            )}

            {/* El plazo del que responde el puesto: es la medida del modelo y de
                ahí sale su estrato. */}
            <p className="os-puesto-plazo">
              <span>Horizonte temporal</span>
              {desdeElPuesto.length > 0 ? desdeElPuesto.join(' · ') : puesto ? plazoDe(puesto) : '—'}
            </p>
          </div>

          {/* Las cinco preguntas, con lo que se contestó: el estrato es la más
              alta que salió que sí. */}
          <ul className="os-comparacion-preguntas">
            {preguntasDelPuesto.map((m) => (
              <li
                key={m.corto}
                className={m.si === true ? 'si' : m.si === false ? 'no' : 'sin'}
                title={`${m.corto}: ${m.si === true ? 'sí' : m.si === false ? 'no' : 'sin contestar'}`}
              >
                {m.corto}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
