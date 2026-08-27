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

export default function Tablero({
  filas,
  citasDeHoy,
  conEvaluadora,
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
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<ColumnaTablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

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
                <span className="os-columna-monto">{suyas.length}</span>
              </div>
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
              {suyas.length === 0 && <p className="os-columna-vacia">{c.vacio}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
