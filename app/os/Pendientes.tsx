'use client';

/**
 * Lo pendiente del equipo: los temas de la próxima reunión y las tareas.
 *
 * El mismo componente sirve para las dos listas, porque son la misma anotación
 * con distinto destino (ver `supabase/pendientes.sql`). Cada línea se puede
 * tildar, mover de una lista a la otra y borrar; el dueño se elige en las
 * tareas y no en los temas.
 *
 * **Un tema de reunión no tiene dueño.** Es algo para hablar entre las tres, y
 * mientras esté en esa lista no es de nadie: repartirlo es justamente moverlo a
 * los pendientes, que es donde el selector aparece. Con el selector en las dos,
 * un tema con nombre se leía como una tarea que alguien ya tenía que hacer.
 *
 * Todo guarda solo y se ve al instante, sin esperar al servidor: es una lista
 * de tres personas anotando cosas, y un botón de guardar la vuelve un trámite.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  COLOR_ESTADO,
  ESTADOS,
  VENCIDA,
  estaVencida,
  estadoVisible,
  type Estado,
  type Pendiente,
} from '@/lib/pendientes-tipos';
import Desplegable from '@/app/os/Desplegable';

const OPCIONES_ESTADO = ESTADOS.map((e) => ({ valor: e, texto: e, color: COLOR_ESTADO[e] }));

/**
 * Vencida entra en la lista solo cuando la tarea lo está.
 *
 * Tiene que estar para que el sello la encuentre y salga con su nombre y su
 * color; elegirla no hace nada, porque el desplegable solo avisa cuando lo
 * elegido es distinto de lo que ya muestra. Para que deje de estar vencida hay
 * que darle otra fecha o darla por hecha, que es lo que de verdad la cambia.
 */
const OPCIONES_VENCIDA = [
  { valor: VENCIDA, texto: VENCIDA, color: COLOR_ESTADO[VENCIDA] },
  ...OPCIONES_ESTADO,
];

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
  otraLista,
  onCambio,
  onBorrar,
}: {
  p: Pendiente;
  /** El día de hoy, del servidor: es lo que dice si la tarea ya venció. */
  hoy: string;
  /** Vacío en los temas de reunión, que no se reparten. */
  equipo: string[];
  otraLista: string;
  onCambio: (campos: Record<string, unknown>) => void;
  onBorrar: () => void;
}) {
  /* Debajo sigue estando el estado guardado: Vencida es lo que se muestra
     mientras la fecha esté pasada. */
  const vencida = estaVencida(p, hoy);

  return (
    <div className={`os-pendiente${p.hecha ? ' hecha' : ''}${vencida ? ' vencida' : ''}`}>
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
            className="os-campo os-pendiente-vence"
            value={p.vence ?? ''}
            onChange={(e) => onCambio({ vence: e.target.value || null })}
            aria-label="Vence"
            /* Con la fila roja, lo que hay que poder averiguar es por qué: el
               mismo "Pendiente" sale gris o rojo según esta fecha, y sin
               decirlo en algún lado los dos colores se leen como un error. */
            title={vencida ? `Venció: era para el ${diaCorto(p.vence)}` : 'Vence'}
          />

          <select
            className="os-pendiente-quien"
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

          <span className="os-pendiente-estado">
            <Desplegable
              valor={estadoVisible(p, hoy)}
              opciones={vencida ? OPCIONES_VENCIDA : OPCIONES_ESTADO}
              alElegir={(v) => onCambio({ estado: v as Estado })}
              etiqueta={
                vencida
                  ? `${p.texto} — venció el ${diaCorto(p.vence)}`
                  : `Estado de: ${p.texto}`
              }
              /* Lo que pide "Pendiente", que es el más largo de los tres: con
                 menos, el estado más común salía cortado con puntos. */
              ancho={120}
            />
          </span>
        </>
      )}

      <button
        type="button"
        className="os-pendiente-accion"
        /* Subir una tarea a la reunión le suelta el dueño: allá no se muestra,
           y sin soltarlo quedaría un nombre guardado que nadie ve y que
           reaparecería al bajarla. */
        onClick={() =>
          onCambio(
            p.para_reunion ? { para_reunion: false } : { para_reunion: true, responsable: null }
          )
        }
        title={`Mover a ${otraLista}`}
        aria-label={`Mover a ${otraLista}`}
      >
        {p.para_reunion ? '↓' : '↑'}
      </button>

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
  otraLista,
}: {
  titulo: string;
  nota?: string;
  filas: Pendiente[];
  /** El día de hoy, calculado en el servidor. */
  hoy: string;
  equipo: string[];
  yo: string;
  paraReunion: boolean;
  otraLista: string;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locales, setLocales] = useState<Pendiente[] | null>(null);

  const vista = locales ?? filas;

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
          otraLista={otraLista}
          onCambio={(campos) => cambiar(p.id, campos)}
          onBorrar={() => borrar(p.id)}
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
