'use client';

/**
 * Lo pendiente del equipo: los temas de la próxima reunión y las tareas.
 *
 * El mismo componente sirve para las dos listas, porque son la misma anotación
 * con distinto destino (ver `supabase/pendientes.sql`). Cada línea se puede
 * tildar, reasignar, mover de una lista a la otra y borrar.
 *
 * Todo guarda solo y se ve al instante, sin esperar al servidor: es una lista
 * de tres personas anotando cosas, y un botón de guardar la vuelve un trámite.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Pendiente } from '@/lib/pendientes';

/** Nombre corto para el selector: el equipo son tres y se reconocen así. */
function corto(nombre: string) {
  return nombre.trim().split(/\s+/)[0];
}

function Linea({
  p,
  equipo,
  otraLista,
  onCambio,
  onBorrar,
}: {
  p: Pendiente;
  equipo: string[];
  otraLista: string;
  onCambio: (campos: Record<string, unknown>) => void;
  onBorrar: () => void;
}) {
  return (
    <div className={`os-pendiente${p.hecha ? ' hecha' : ''}`}>
      <button
        type="button"
        className={`os-check${p.hecha ? ' puesto' : ''}`}
        onClick={() => onCambio({ hecha: !p.hecha })}
        aria-pressed={p.hecha}
        aria-label={p.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
      >
        ✓
      </button>

      <span className="os-pendiente-texto">{p.texto}</span>

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

      <button
        type="button"
        className="os-pendiente-accion"
        onClick={() => onCambio({ para_reunion: !p.para_reunion })}
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
  equipo,
  yo,
  paraReunion,
  otraLista,
}: {
  titulo: string;
  nota?: string;
  filas: Pendiente[];
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
