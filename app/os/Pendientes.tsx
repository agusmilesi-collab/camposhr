'use client';

/**
 * Lo pendiente del equipo: los temas de la próxima reunión y las tareas.
 *
 * El mismo componente sirve para las dos listas, que comparten tabla y se
 * separan por `para_reunion` (ver `supabase/pendientes.sql`). Lo que se hace en
 * cada una es distinto: un tema se ordena y se tilda, una tarea se reparte, se
 * fecha y cambia de estado.
 *
 * **No se pasan de una lista a la otra.** Hubo un botón para hacerlo y se sacó
 * el 27/8/2026: un tema para hablar entre las tres y una tarea con dueño y
 * fecha no son la misma anotación con distinto destino, así que convertir una
 * en otra no es un movimiento sino inventarle la mitad de los datos o tirarlos.
 *
 * **Un tema de reunión no tiene dueño.** Es algo para hablar entre las tres, y
 * mientras esté en esa lista no es de nadie. Con el selector en las dos, un
 * tema con nombre se leía como una tarea que alguien ya tenía que hacer.
 *
 * **Los temas se ordenan arrastrándolos.** Se listaban por antigüedad, que es
 * el orden en que se fueron anotando y no el orden en que conviene hablarlos:
 * un tema que entró último puede ser el que abre la reunión. Las tareas no se
 * arrastran, porque su prioridad ya la lleva la fecha en que vencen y dos
 * criterios para la misma lista terminan contradiciéndose.
 *
 * Todo guarda solo y se ve al instante, sin esperar al servidor: es una lista
 * de tres personas anotando cosas, y un botón de guardar la vuelve un trámite.
 */

/** Deja que el navegador anime el renglón que cambia de lugar. */
function mover(cambio: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition !== 'function') {
    cambio();
    return;
  }
  doc.startViewTransition(() => flushSync(cambio));
}

import { useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';
import { useState, useTransition } from 'react';
import {
  COLOR_ESTADO,
  ESTADOS,
  estaVencida,
  type Estado,
  type Pendiente,
} from '@/lib/pendientes-tipos';
import Desplegable from '@/app/os/Desplegable';

const OPCIONES_ESTADO = ESTADOS.map((e) => ({ valor: e, texto: e, color: COLOR_ESTADO[e] }));

/** La fecha guardada (2026-08-25) como se lee acá: 25/8/2026. */
function diaCorto(iso: string | null): string {
  if (!iso) return 'sin fecha';
  const [a, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${a}`;
}

/** Nombre corto para el selector: el equipo son tres y se reconocen así. */
function corto(nombre: string) {
  return nombre.trim().split(/\s+/)[0];
}

function Linea({
  p,
  hoy,
  equipo,
  ordenable,
  onCambio,
  onBorrar,
  onArrastrar,
  onEncima,
  onSoltar,
}: {
  p: Pendiente;
  /** El día de hoy, del servidor: es lo que dice si la tarea ya venció. */
  hoy: string;
  /** Vacío en los temas de reunión, que no se reparten. */
  equipo: string[];
  /** Si esta fila se puede arrastrar para cambiarla de lugar. */
  ordenable: boolean;
  onCambio: (campos: Record<string, unknown>) => void;
  onBorrar: () => void;
  onArrastrar: () => void;
  onEncima: () => void;
  onSoltar: () => void;
}) {
  /* Vencida no es otro estado: la tarea sigue siendo la que era y lo que cambia
     es que reclama. Se dice con el color de la fecha y del sello, que siguen
     diciendo cuándo era y en qué anda. */
  const vencida = estaVencida(p, hoy);

  return (
    <div
      className={`os-pendiente${p.hecha ? ' hecha' : ''}${vencida ? ' vencida' : ''}${
        ordenable ? ' os-pendiente-mueve' : ''
      }`}
      style={ordenable ? ({ viewTransitionName: `tema-${p.id}` } as React.CSSProperties) : undefined}
      draggable={ordenable}
      onDragStart={onArrastrar}
      onDragOver={(ev) => {
        if (!ordenable) return;
        ev.preventDefault();
        onEncima();
      }}
      onDrop={(ev) => {
        if (!ordenable) return;
        // Frenarlo es lo que le dice al navegador que el destino valía: sin
        // eso el renglón vuelve volando al lugar del que salió, y el texto que
        // viaja en el arrastre se escribe adentro del campo que haya debajo.
        ev.preventDefault();
        onSoltar();
      }}
      onDragEnd={onSoltar}
    >
      {/* El tilde es de los temas, que están hablados o no. Una tarea lo dice
          en su estado, y con las dos cosas se podía tildar algo que seguía
          diciendo "Pendiente". */}
      {p.para_reunion && (
        <button
          type="button"
          className={`os-check${p.hecha ? ' puesto' : ''}`}
          onClick={() => onCambio({ hecha: !p.hecha })}
          aria-pressed={p.hecha}
          aria-label={p.hecha ? 'Marcar como pendiente' : 'Marcar como hablado'}
        >
          ✓
        </button>
      )}

      <span className="os-pendiente-texto">{p.texto}</span>

      {!p.para_reunion && (
        <>
          {/* Cuándo deja de poder esperar. Vacío es "sin fecha", que no es lo
              mismo que vencida: la tarea existe igual y no reclama nada. */}
          <input
            type="date"
            className="os-control-suave os-pendiente-vence"
            value={p.vence ?? ''}
            onChange={(e) => onCambio({ vence: e.target.value || null })}
            aria-label="Vence"
            /* Con la fila roja, lo que hay que poder averiguar es por qué: el
               mismo "Pendiente" sale gris o rojo según esta fecha, y sin
               decirlo en algún lado los dos colores se leen como un error. */
            title={vencida ? `Venció: era para el ${diaCorto(p.vence)}` : 'Vence'}
          />

          <select
            className="os-control-suave os-pendiente-quien"
            value={p.responsable ?? ''}
            onChange={(e) => onCambio({ responsable: e.target.value || null })}
            aria-label="Responsable"
          >
            <option value="">Sin dueño</option>
            {equipo.map((n) => (
              <option key={n} value={n}>
                {corto(n)}
              </option>
            ))}
          </select>

          <span className="os-control-suave os-pendiente-estado">
            <Desplegable
              valor={p.estado}
              opciones={OPCIONES_ESTADO}
              alElegir={(v) => onCambio({ estado: v as Estado })}
              etiqueta={
                vencida
                  ? `${p.texto} — venció el ${diaCorto(p.vence)}`
                  : `Estado de: ${p.texto}`
              }
              /* Lo que pide "Pendiente", que es el más largo: con menos, el
                 estado más común salía cortado con puntos. */
              ancho={118}
            />
          </span>
        </>
      )}

      <button
        type="button"
        className="os-pendiente-accion"
        onClick={onBorrar}
        title="Borrar"
        aria-label="Borrar"
      >
        ×
      </button>
    </div>
  );
}

export default function Pendientes({
  titulo,
  nota,
  filas,
  hoy,
  equipo,
  yo,
  paraReunion,
}: {
  titulo: string;
  nota?: string;
  filas: Pendiente[];
  /** El día de hoy, calculado en el servidor. */
  hoy: string;
  equipo: string[];
  yo: string;
  paraReunion: boolean;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locales, setLocales] = useState<Pendiente[] | null>(null);
  const [tomado, setTomado] = useState<string | null>(null);

  const vista = locales ?? filas;

  /**
   * Reordena mientras se arrastra: el renglón tomado se mete donde está el que
   * se pasa por encima.
   *
   * Se cede el lugar al pasar por el vecino y no al soltar, así se ve dónde va
   * a quedar antes de largarlo. Lo que se manda al servidor es la lista entera
   * en su orden nuevo, al soltar, y no cada paso del camino.
   */
  function acomodar(sobre: string) {
    if (!tomado || tomado === sobre) return;
    const actual = vista;
    const desde = actual.findIndex((f) => f.id === tomado);
    const hasta = actual.findIndex((f) => f.id === sobre);
    if (desde < 0 || hasta < 0) return;
    const nueva = [...actual];
    const [fila] = nueva.splice(desde, 1);
    nueva.splice(hasta, 0, fila);
    mover(() => setLocales(nueva));
  }

  async function guardarOrden() {
    if (!tomado) return;
    setTomado(null);
    if (!locales) return;
    const orden = locales.map((f) => f.id);
    // Mismo orden que el que ya estaba: no hay nada que guardar.
    if (orden.join() === filas.map((f) => f.id).join()) return;
    await pedir({ method: 'POST', body: JSON.stringify({ orden }) });
  }

  async function pedir(init: RequestInit & { url?: string }) {
    setError(null);
    try {
      const res = await fetch(init.url ?? '/api/os/pendientes', {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return null;
      }
      empezar(() => {
        router.refresh();
        setLocales(null);
      });
      return r;
    } catch {
      setError('No se pudo guardar.');
      return null;
    }
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    // Una tarea nueva arranca de quien la anota; un tema de reunión no tiene
    // dueño hasta que se reparte.
    await pedir({
      method: 'PUT',
      body: JSON.stringify({
        campos: { texto: t, para_reunion: paraReunion, responsable: paraReunion ? null : yo },
      }),
    });
  }

  async function cambiar(id: string, campos: Record<string, unknown>) {
    setLocales(vista.map((f) => (f.id === id ? { ...f, ...(campos as object) } : f)));
    const r = await pedir({ method: 'POST', body: JSON.stringify({ id, campos }) });
    if (!r) setLocales(null);
  }

  async function borrar(id: string) {
    setLocales(vista.filter((f) => f.id !== id));
    const r = await pedir({ method: 'DELETE', url: `/api/os/pendientes?id=${id}` });
    if (!r) setLocales(null);
  }

  return (
    <section className={`os-panel${paraReunion ? ' os-panel-reunion' : ''}`}>
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {nota && <span className="os-columna-monto">{nota}</span>}
      </div>

      {error && <p className="os-form-error">{error}</p>}

      {vista.length === 0 && <p className="os-vacio">Nada anotado todavía.</p>}

      {vista.map((p) => (
        <Linea
          key={p.id}
          p={p}
          hoy={hoy}
          equipo={equipo}
          ordenable={paraReunion}
          onCambio={(campos) => cambiar(p.id, campos)}
          onBorrar={() => borrar(p.id)}
          onArrastrar={() => setTomado(p.id)}
          onEncima={() => acomodar(p.id)}
          onSoltar={guardarOrden}
        />
      ))}

      <form className="os-pendiente-alta" onSubmit={agregar}>
        <input
          className="os-campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={paraReunion ? 'Sumar un tema…' : 'Sumar una tarea…'}
          maxLength={500}
          aria-label={paraReunion ? 'Nuevo tema' : 'Nueva tarea'}
        />
        <button className="os-boton" type="submit" disabled={!texto.trim()}>
          Sumar
        </button>
      </form>
    </section>
  );
}
