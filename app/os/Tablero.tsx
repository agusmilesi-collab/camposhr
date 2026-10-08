'use client';

/**
 * El tablero de la home: qué está haciendo cada una y qué sigue después.
 *
 * Reemplaza a la lista "Psicotécnicos en curso", que decía lo mismo en el
 * mismo orden todos los días: era el estado del pipeline y no el del trabajo.
 * Con una evaluación abierta en la mano, lo que hace falta saber es qué agarrar
 * cuando esa se termine, y eso no lo contesta una lista ordenada por etapa.
 *
 * **Las columnas no son etapas.** La etapa sigue su circuito por su cuenta
 * (`Entrevistas.tsx`, donde arrastrar sí la cambia); acá se arrastra para decir
 * en qué anda una, y una evaluación puede estar "Por analizar" desde hace una
 * semana sin que nadie la haya empezado. Por eso la tarjeta muestra las dos
 * cosas: la columna es de quien trabaja, el sello de etapa es del circuito.
 *
 * **Lo agendado para hoy entra solo en Hoy, y se ve distinto.** Una entrevista
 * es una cita con una persona a una hora: no se elige cuándo hacerla ni se
 * puede dejar para mañana, así que va sola a esa columna y sale pintada de azul
 * con la hora grande. Al lado de un análisis, que es trabajo que se acomoda, la
 * diferencia tiene que verse antes de leer el nombre. Por eso la home ya no
 * tiene su propio panel de "Entrevistas de hoy": decía lo mismo un renglón más
 * arriba.
 *
 * **No hay columna de terminadas.** Un informe que se sube al portal ya está
 * listo, así que la tarjeta se va del tablero cuando la evaluación se entrega:
 * una columna de hechas se llena sola y se lleva un cuarto de la pantalla para
 * mostrar algo que nadie necesita mirar. Lo entregado vive en Entregados.
 *
 * **La prioridad se calcula mientras nadie opine.** Sin fijar, sale de los días
 * que lleva solicitada (`prioridadPorDefecto`), así lo que espera hace más
 * tiempo sube solo. Elegirla a mano la clava, que es lo que hace falta cuando el
 * cliente apura algo que entró ayer.
 *
 */

import Link from 'next/link';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Evaluacion } from '@/lib/psicotecnicos';
import {
  COLOR_ETAPA,
  COLOR_PRIORIDAD,
  PRIORIDADES,
  prioridadDe,
  type ColumnaTablero,
  type Prioridad,
} from '@/lib/psicotecnicos-tipos';
import { soloHora } from '@/lib/hora';
import Desplegable from '@/app/os/Desplegable';

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

/** Lo que elige el desplegable para volver al cálculo por antigüedad. */
const AUTOMATICA = 'por-espera';

const COLUMNAS: { clave: ColumnaTablero; titulo: string; vacio: string }[] = [
  { clave: 'backlog', titulo: 'Backlog', vacio: 'Nada esperando' },
  { clave: 'hoy', titulo: 'Hoy', vacio: 'Nada elegido para hoy' },
  { clave: 'en_curso', titulo: 'En curso', vacio: 'Nada empezado' },
];

/**
 * En qué columna cae una tarjeta.
 *
 * Lo que tiene entrevista hoy va a Hoy aunque nadie lo haya arrastrado: la hora
 * ya está acordada con la persona. Sin columna guardada, backlog.
 */
function columnaDe(e: Evaluacion, hoy: Set<string>): ColumnaTablero {
  return hoy.has(e.id) ? 'hoy' : e.tablero ?? 'backlog';
}

/**
 * Las tres, más la salida.
 *
 * "Por espera" borra la prioridad fijada y devuelve la evaluación al cálculo
 * por antigüedad. Sin esa opción, tocar el desplegable una vez la clavaba para
 * siempre: la prioridad quedaba en la banda de ese día y el paso del tiempo ya
 * no la movía.
 */
const OPCIONES = [
  ...PRIORIDADES.map((p) => ({
    valor: p,
    texto: p[0].toUpperCase() + p.slice(1),
    color: COLOR_PRIORIDAD[p],
  })),
  { valor: AUTOMATICA, texto: 'Por espera' },
];

const PESO: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

/** Deja que el navegador anime el recorrido de la tarjeta entre columnas. */
function mover(cambio: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition !== 'function') {
    cambio();
    return;
  }
  doc.startViewTransition(() => flushSync(cambio));
}

/**
 * Primero lo que más apura, y entre dos de la misma prioridad lo que espera
 * hace más tiempo: es el mismo criterio que da la prioridad por defecto, así
 * que fijar una a mano mueve la tarjeta de banda sin desordenar el resto.
 */
function ordenar(filas: Evaluacion[], hoy: Set<string>): Evaluacion[] {
  return [...filas].sort((a, b) => {
    // Lo que tiene hora va arriba y en orden de agenda: es lo único del día que
    // no se puede correr de lugar.
    const cita = Number(hoy.has(b.id)) - Number(hoy.has(a.id));
    if (cita) return cita;
    if (hoy.has(a.id)) {
      return (a.fechaEntrevista ?? '').localeCompare(b.fechaEntrevista ?? '');
    }
    return (
      PESO[prioridadDe(a)] - PESO[prioridadDe(b)] ||
      (b.diasSolicitud ?? -1) - (a.diasSolicitud ?? -1) ||
      a.nombre.localeCompare(b.nombre)
    );
  });
}

/**
 * Una tarjeta del tablero.
 *
 * Vive fuera del componente a propósito: definida adentro, React la trata como
 * un tipo nuevo en cada dibujo y desmonta el subárbol entero, que acá se comería
 * el clic en el desplegable de prioridad. Está escrito en `CLAUDE.md`.
 */
function Tarjeta({
  e,
  cita,
  arrastrando,
  ocupada,
  conEvaluadora,
  onArrastrar,
  onSoltar,
  onPrioridad,
}: {
  e: Evaluacion;
  /** La entrevista es hoy: la tarjeta es una cita y no trabajo que se acomoda. */
  cita: boolean;
  arrastrando: boolean;
  ocupada: boolean;
  conEvaluadora: boolean;
  onArrastrar: (ev: React.DragEvent) => void;
  onSoltar: () => void;
  onPrioridad: (p: Prioridad | null) => void;
}) {
  const prioridad = prioridadDe(e);

  if (cita) {
    /**
     * La entrevista de hoy. Abre la hoja para tomarla, que es lo que se hace
     * con ella; el resto de la ficha está a un clic desde ahí.
     *
     * No se arrastra: la hora la puso el acuerdo con la persona, y moverla de
     * columna diría que se decidió hacerla otro día.
     */
    return (
      <Link
        className="os-mini os-mini-cita"
        style={{ viewTransitionName: `tablero-${e.id}` } as React.CSSProperties}
        href={`/os/psicotecnicos/ficha/${e.id}?ver=entrevista`}
      >
        {/* Todo en el mismo renglón y de la misma letra: la hora es lo que se
            busca de un vistazo, así que va grande, y qué es y de qué modo va
            detrás y más chico, sin dejar de ser la misma frase. */}
        <span className="os-mini-hora">
          {soloHora(e.fechaEntrevista) ?? 'Sin hora'}{' '}
          <span className="os-mini-cita-modo">
            Entrevista{e.modalidad ? ` ${e.modalidad}` : ''}
          </span>
        </span>
        <span className="os-mini-nombre">{e.nombre}</span>
        <span className="os-mini-detalle">
          {e.empresa} · {e.puesto}
          {conEvaluadora && e.evaluadora ? ` · ${e.evaluadora}` : ''}
        </span>
      </Link>
    );
  }

  return (
    <article
      className={`os-mini${arrastrando ? ' arrastrando' : ''}`}
      style={{ viewTransitionName: `tablero-${e.id}` } as React.CSSProperties}
      draggable
      onDragStart={onArrastrar}
      onDragEnd={onSoltar}
    >
      <Link className="os-mini-cuerpo" href={`/os/psicotecnicos/ficha/${e.id}`}>
        <span className="os-mini-nombre">{e.nombre}</span>
        <span className="os-mini-detalle">
          {e.empresa} · {e.puesto}
          {conEvaluadora && e.evaluadora ? ` · ${e.evaluadora}` : ''}
        </span>
      </Link>
      <div className="os-mini-pie">
        <span className={`os-sello-estado os-mini-etapa ${COLOR_ETAPA[e.etapa] ?? 'os-gris'}`}>
          {e.etapa}
        </span>
        {/* El sello de prioridad es el control: se lee y se cambia en el mismo
            lugar, que en una tarjeta de este tamaño es lo único que entra. */}
        {/* Apagada mientras la calcula la espera: distingue de un vistazo la
            prioridad que alguien decidió de la que se mueve sola. */}
        <span className={`os-mini-prioridad${e.prioridad ? '' : ' os-mini-auto'}`}>
          <Desplegable
            valor={prioridad}
            opciones={OPCIONES}
            alElegir={(v) => onPrioridad(v === AUTOMATICA ? null : (v as Prioridad))}
            deshabilitado={ocupada}
            etiqueta={`Prioridad de ${e.nombre}`}
            /* Todas las pastillas miden lo mismo, diga lo que diga adentro: con
               el ancho del texto, las de una columna quedaban de tres largos y
               la banda se leía por el tamaño antes que por el color. Es lo que
               pide la más larga, "Media". */
            ancho={70}
          />
        </span>
      </div>
    </article>
  );
}

/**
 * Una propuesta enviada que ya pide que alguien pregunte cómo viene.
 *
 * No es una evaluación y no se arrastra: entra sola a Hoy cuando pasaron los
 * días, y se va cuando alguien dice que ya la siguió o cuando la cotización
 * cambia de estado. Lo ven las tres, porque seguir una propuesta no es de
 * nadie en particular.
 */
export type Seguimiento = {
  id: string;
  cliente: string;
  concepto: string;
  /** Días desde que se mandó, o desde el último seguimiento. */
  dias: number;
  token: string | null;
};

export default function Tablero({
  filas,
  citasDeHoy,
  conEvaluadora,
  seguimientos = [],
  sinAsignar = null,
  comprobantes = [],
  renovaciones = [],
}: {
  filas: Evaluacion[];
  /**
   * Quiénes tienen entrevista hoy y todavía no se tomó.
   *
   * Los elige el servidor: qué día es hoy depende del huso, y calculado en el
   * navegador la primera pintura no coincide con la que llega del servidor.
   */
  citasDeHoy: string[];
  /** Si la tarjeta dice de quién es: solo cuando quien mira ve el conjunto. */
  conEvaluadora: boolean;
  /** Las propuestas que hay que seguir hoy. */
  seguimientos?: Seguimiento[];
  /**
   * Los candidatos que entraron sin evaluadora, para el aviso de Hoy.
   *
   * Llegan solos desde el portal del cliente y quedan en "Sin asignar" hasta
   * que alguien los reparte. El círculo de la barra los cuenta, pero en Inicio
   * no se veían: repartir es trabajo del día, así que va en Hoy y lo ven todas.
   */
  sinAsignar?: { cuantos: number; nombres: string[]; clientes: string[] } | null;
  /**
   * Los comprobantes de transferencia que subieron los inquilinos del Centro y
   * esperan que se registre el pago.
   *
   * Van en Hoy porque la plata ya salió de la cuenta de la persona: mientras el
   * pago no esté registrado, su cuenta le sigue mostrando la deuda. La tarjeta
   * se va sola cuando se registra el pago de ese mes.
   */
  comprobantes?: {
    id: string;
    inquilinoId: string;
    inquilino: string;
    periodo: string;
    mes: string;
    /** Lo que debe de ese mes: contra esto se compara el papel. */
    debe: number;
  }[];
  /**
   * Los inquilinos que contestaron que no renuevan o que quieren cambiar sus
   * horas para el mes que viene. Las bandas las mueve el equipo: la tarjeta
   * avisa, lleva a la ficha y se va cuando alguien la da por atendida.
   */
  renovaciones?: {
    id: string;
    inquilinoId: string;
    inquilino: string;
    mes: string;
    respuesta: 'si' | 'no' | 'cambiar';
    nota: string | null;
    /** Los feriados en los que igual quiere su sala, ya escritos: "23/11". */
    feriados?: string[];
  }[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<ColumnaTablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  /** Las que alguien acaba de seguir, para que la tarjeta se vaya al toque. */
  const [seguidas, setSeguidas] = useState<string[]>([]);

  async function seguida(id: string) {
    setSeguidas((xs) => [...xs, id]);
    try {
      const res = await fetch('/api/os/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'seguimiento', id }),
      });
      if (!res.ok) throw new Error();
      empezar(() => router.refresh());
    } catch {
      setSeguidas((xs) => xs.filter((x) => x !== id));
      setError('No se pudo guardar el seguimiento.');
    }
  }

  /**
   * Dar por pagado un comprobante, en dos toques.
   *
   * El primero arma el botón con el importe escrito y el segundo registra: un
   * pago es plata en la cuenta de alguien, y un toque de más en el teléfono no
   * puede ser un recibo emitido.
   */
  const [porPagar, setPorPagar] = useState<string | null>(null);
  const [pagados, setPagados] = useState<string[]>([]);

  async function pagado(id: string) {
    setPorPagar(null);
    setPagados((xs) => [...xs, id]);
    try {
      const res = await fetch('/api/os/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'comprobante-pagado', id }),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.ok) throw new Error(r?.motivo);
      empezar(() => router.refresh());
    } catch (e) {
      setPagados((xs) => xs.filter((x) => x !== id));
      setError(e instanceof Error && e.message ? e.message : 'No se pudo registrar el pago.');
    }
  }

  const [atendidas, setAtendidas] = useState<string[]>([]);

  async function atendida(id: string) {
    setAtendidas((xs) => [...xs, id]);
    try {
      const res = await fetch('/api/os/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'renovacion-vista', id }),
      });
      if (!res.ok) throw new Error();
      empezar(() => router.refresh());
    } catch {
      setAtendidas((xs) => xs.filter((x) => x !== id));
      setError('No se pudo guardar.');
    }
  }
  const porRenovar = renovaciones.filter((r) => !atendidas.includes(r.id));

  /** Lo cambiado en pantalla que el servidor todavía no confirmó. */
  const [movidas, setMovidas] = useState<Record<string, Partial<Evaluacion>>>({});

  const citas = useMemo(() => new Set(citasDeHoy), [citasDeHoy]);

  const todas = useMemo(
    () => filas.map((e) => (movidas[e.id] ? { ...e, ...movidas[e.id] } : e)),
    [filas, movidas]
  );

  // Cuando el servidor devuelve la fila donde la dejamos, el movimiento deja de
  // ser una promesa y se borra.
  useEffect(() => {
    setMovidas((previas) => {
      const quedan: typeof previas = {};
      for (const [id, m] of Object.entries(previas)) {
        const real = filas.find((x) => x.id === id);
        const confirmada =
          real && Object.entries(m).every(([k, v]) => (real as Record<string, unknown>)[k] === v);
        if (!confirmada) quedan[id] = m;
      }
      return Object.keys(quedan).length === Object.keys(previas).length ? previas : quedan;
    });
  }, [filas]);

  /**
   * Guarda un campo del tablero, con la tarjeta ya movida en pantalla.
   *
   * Se dibuja primero y se guarda después porque el gesto es de un segundo: si
   * la tarjeta esperara la respuesta, quien arrastra la vería volver al lugar
   * del que salió. Si el guardado falla, vuelve de verdad y se dice por qué.
   */
  async function guardar(id: string, cambios: Partial<Evaluacion>) {
    setError(null);
    setTrabajando(id);
    mover(() => setMovidas((m) => ({ ...m, [id]: { ...m[id], ...cambios } })));

    const volver = () =>
      setMovidas((m) => {
        const { [id]: _, ...resto } = m;
        return resto;
      });

    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        volver();
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      volver();
      setError('No se pudo guardar.');
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="os-mini-tablero">
      {error && <p className="os-form-error">{error}</p>}

      <div
        className="os-kanban os-kanban-mini"
        style={{ '--os-columnas': COLUMNAS.length } as React.CSSProperties}
      >
        {COLUMNAS.map((c) => {
          const suyas = ordenar(
            todas.filter((e) => columnaDe(e, citas) === c.clave),
            citas
          );
          return (
            <div
              key={c.clave}
              className={`os-columna${encima === c.clave ? ' encima' : ''}`}
              onDragOver={(ev) => {
                ev.preventDefault();
                setEncima(c.clave);
              }}
              onDragLeave={() => setEncima((v) => (v === c.clave ? null : v))}
              onDrop={(ev) => {
                ev.preventDefault();
                setEncima(null);
                // Se apaga acá y no solo en la tarjeta: al soltar, esa
                // tarjeta se desmonta de su columna vieja antes de que llegue
                // el `dragend`, así que ese aviso no lo recibe nadie y la
                // tarjeta que aparece en la columna nueva se queda a media
                // opacidad hasta que se arrastre otra.
                setArrastrando(null);
                const id = ev.dataTransfer.getData('text/plain');
                const fila = todas.find((x) => x.id === id);
                if (fila && columnaDe(fila, citas) !== c.clave) guardar(id, { tablero: c.clave });
              }}
            >
              <div className="os-columna-top">
                <span className="os-columna-titulo">{c.titulo}</span>
                <span className="os-columna-monto">
                  {suyas.length +
                    (c.clave === 'hoy'
                      ? seguimientos.filter((s) => !seguidas.includes(s.id)).length +
                        (sinAsignar && sinAsignar.cuantos > 0 ? 1 : 0) +
                        comprobantes.filter((k) => !pagados.includes(k.id)).length +
                        porRenovar.length
                      : 0)}
                </span>
              </div>
              {/* Asignar evaluadora: arriba de todo en Hoy, mientras haya
                  candidatos sin dueña. Lleva a la columna donde se reparten. */}
              {c.clave === 'hoy' && sinAsignar && sinAsignar.cuantos > 0 && (
                <article className="os-mini os-mini-asignar">
                  <div className="os-mini-cuerpo">
                    <span className="os-mini-nombre">Asignar evaluadora</span>
                    <span className="os-mini-detalle">
                      {sinAsignar.nombres.length > 3
                        ? `${sinAsignar.nombres.slice(0, 3).join(', ')} y ${
                            sinAsignar.nombres.length - 3
                          } más`
                        : sinAsignar.nombres.join(', ')}
                      {sinAsignar.clientes.length > 0 && ` · ${sinAsignar.clientes.join(', ')}`}
                    </span>
                  </div>
                  <div className="os-mini-pie">
                    <Link className="os-enlace" href="/os/psicotecnicos/entrevistas">
                      Repartir
                    </Link>
                  </div>
                </article>
              )}
              {c.clave === 'hoy' &&
                comprobantes
                  .filter((k) => !pagados.includes(k.id))
                  .map((k) => (
                    <article key={k.id} className="os-mini os-mini-seguimiento os-mini-comprobante">
                      {/* Arriba, quién y cuánto: el importe a la derecha y con
                          cifras parejas, que es lo que se compara contra el
                          papel. */}
                      <div className="os-mini-cuerpo">
                        <span className="os-mini-comprobante-top">
                          <span className="os-mini-nombre">{k.inquilino}</span>
                          <span className="os-mini-importe">{pesos(k.debe)}</span>
                        </span>
                        {/* Cuando el papel dice otro importe, el pago se carga
                            a mano en la ficha, que deja escribir cuánto entró.
                            Va en el renglón de la descripción y no en uno
                            propio: con una franja más, esta tarjeta era más
                            alta que todas las del tablero. */}
                        <span className="os-mini-comprobante-top">
                          <span className="os-mini-detalle" title={k.mes}>
                            Subió comprobante de pago
                          </span>
                          <Link
                            className="os-enlace os-mini-otro"
                            href={`/os/consultorios/inquilino/${k.inquilinoId}?periodo=${k.periodo}`}
                          >
                            No coincide
                          </Link>
                        </span>
                      </div>
                      {/* Dos botones del mismo ancho: mirar el papel y dar el
                          pago por recibido. Al confirmar siguen siendo dos, en
                          el mismo lugar: cancelar donde estaba mirar, y
                          confirmar donde estaba marcar. */}
                      <div className="os-mini-acciones">
                        {porPagar === k.id ? (
                          <>
                            <button type="button" className="os-boton" onClick={() => setPorPagar(null)}>
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="os-boton os-boton-firme"
                              onClick={() => pagado(k.id)}
                            >
                              {/* Sin el importe: en media tarjeta no entra, y ya está
                                  escrito arriba, en la misma tarjeta. */}
                              Confirmar
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              className="os-boton"
                              href={`/api/os/centro-comprobante/${k.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver comprobante
                            </a>
                            <button
                              type="button"
                              className="os-boton os-boton-firme"
                              onClick={() => setPorPagar(k.id)}
                            >
                              {k.debe > 0 ? 'Marcar pagado' : 'Quitar aviso'}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
              {c.clave === 'hoy' &&
                porRenovar.map((r) => (
                  <article key={r.id} className="os-mini os-mini-seguimiento os-mini-comprobante">
                    <div className="os-mini-cuerpo">
                      <span className="os-mini-comprobante-top">
                        <span className="os-mini-nombre">{r.inquilino}</span>
                        <span className="os-mini-importe">{r.mes}</span>
                      </span>
                      <span className="os-mini-detalle" title={r.nota ?? undefined}>
                        {r.respuesta === 'no'
                          ? 'No renueva sus horas'
                          : [
                              r.respuesta === 'cambiar' ? `Quiere cambiar horas: ${r.nota ?? ''}` : null,
                              r.feriados && r.feriados.length > 0
                                ? `Usa su sala el feriado del ${r.feriados.join(' y ')}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                      </span>
                    </div>
                    <div className="os-mini-acciones">
                      <Link className="os-boton" href={`/os/consultorios/inquilino/${r.inquilinoId}`}>
                        Ver ficha
                      </Link>
                      <button
                        type="button"
                        className="os-boton os-boton-firme"
                        onClick={() => atendida(r.id)}
                      >
                        Listo
                      </button>
                    </div>
                  </article>
                ))}
              {c.clave === 'hoy' &&
                seguimientos
                  .filter((s) => !seguidas.includes(s.id))
                  .map((s) => (
                    <article key={s.id} className="os-mini os-mini-seguimiento">
                      <div className="os-mini-cuerpo">
                        <span className="os-mini-nombre">{s.cliente}</span>
                        <span className="os-mini-detalle">
                          Propuesta enviada hace {s.dias} {s.dias === 1 ? 'día' : 'días'} ·{' '}
                          {s.concepto}
                        </span>
                      </div>
                      <div className="os-mini-pie">
                        {s.token ? (
                          <a
                            className="os-enlace"
                            href={`/q/${s.token}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver la propuesta
                          </a>
                        ) : (
                          <Link className="os-enlace" href="/os/cotizaciones">
                            Ver el embudo
                          </Link>
                        )}
                        <button
                          type="button"
                          className="os-boton-chico"
                          onClick={() => seguida(s.id)}
                        >
                          Ya la seguí
                        </button>
                      </div>
                    </article>
                  ))}

              {suyas.map((e) => (
                <Tarjeta
                  key={e.id}
                  e={e}
                  cita={citas.has(e.id)}
                  arrastrando={arrastrando === e.id}
                  ocupada={trabajando === e.id}
                  conEvaluadora={conEvaluadora}
                  onArrastrar={(ev) => {
                    ev.dataTransfer.setData('text/plain', e.id);
                    ev.dataTransfer.effectAllowed = 'move';
                    setArrastrando(e.id);
                  }}
                  onSoltar={() => setArrastrando(null)}
                  onPrioridad={(p) => guardar(e.id, { prioridad: p })}
                />
              ))}
              {suyas.length === 0 &&
                !(
                  c.clave === 'hoy' &&
                  (seguimientos.some((s) => !seguidas.includes(s.id)) ||
                    (sinAsignar?.cuantos ?? 0) > 0 ||
                    comprobantes.some((k) => !pagados.includes(k.id)) ||
                    porRenovar.length > 0)
                ) && (
                  <p className="os-columna-vacia">{c.vacio}</p>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
