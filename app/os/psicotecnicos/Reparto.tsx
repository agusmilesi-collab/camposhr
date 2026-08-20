'use client';

/**
 * El reparto: quién toma a quién.
 *
 * Una columna con lo que no tiene dueño y una por evaluadora. Se arrastra la
 * tarjeta a la columna de quien la va a tomar, y con eso la persona sale de
 * "Sin asignar" y entra en su cola de "Por citar", que es el trabajo siguiente.
 * Arrastrarla de vuelta a la primera columna deshace las dos cosas.
 *
 * Las columnas de cada evaluadora muestran todo lo que tiene abierto y no solo
 * lo que se acaba de asignar: repartir sin ver cuánto tiene cada una encima es
 * repartir a ciegas.
 *
 * Se guarda en un solo pedido con los dos campos juntos. Si viajaran por
 * separado, un corte en el medio dejaría a alguien con evaluadora y todavía en
 * la columna de sin asignar.
 */

import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { COLOR_ETAPA } from '@/lib/psicotecnicos-tipos';
import { enDias } from '@/lib/hora';

/** Lo que cuenta como carga de trabajo abierta de una evaluadora. */
const ABIERTAS = new Set(['Por citar', 'Por entrevistar', 'Por analizar']);

const SIN_DUENO = '__sin_asignar';

/**
 * El mismo orden que arma el servidor (`porEspera` en `datos.ts`): lo más viejo
 * arriba. Se repite acá para que la tarjeta recién soltada caiga directamente
 * en el lugar que le va a tocar, sin reacomodarse cuando llega la respuesta.
 */
/**
 * Aplica un cambio de columna dejando que el navegador anime el recorrido.
 *
 * Con `startViewTransition` la tarjeta se desplaza de una columna a la otra y
 * es siempre la misma; sin ella el cambio se ve de golpe, que es como se veía
 * antes. Los navegadores que no la tienen aplican el cambio y nada más.
 */
function mover(cambio: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (typeof doc.startViewTransition !== 'function') {
    cambio();
    return;
  }
  doc.startViewTransition(() => flushSync(cambio));
}

function porEspera(filas: Evaluacion[]): Evaluacion[] {
  return [...filas].sort((a, b) => {
    const espera = (x: Evaluacion) => x.dias ?? x.diasEsperando ?? -1;
    return espera(b) - espera(a) || a.nombre.localeCompare(b.nombre);
  });
}

function Tarjeta({
  e,
  onDragStart,
  onDragEnd,
  arrastrando,
}: {
  e: Evaluacion;
  onDragStart: (ev: React.DragEvent) => void;
  onDragEnd: () => void;
  arrastrando: boolean;
}) {
  return (
    <article
      className={`os-tarjeta-op${arrastrando ? ' arrastrando' : ''}`}
      // El navegador necesita un nombre por tarjeta para reconocerla en la
      // columna nueva y desplazarla, en vez de borrarla y dibujarla de nuevo.
      style={{ viewTransitionName: `ficha-${e.id}` } as React.CSSProperties}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="os-tarjeta-cliente">{e.empresa}</div>
      <div className="os-tarjeta-concepto">
        {e.nombre} · {e.puesto}
        {e.bateria ? ` · ${e.bateria}` : ''}
      </div>
      <div className="os-tarjeta-pie">
        <span className={`os-sello-estado ${COLOR_ETAPA[e.etapa] ?? 'os-gris'}`}>
          {e.etapa}
        </span>
        <span className="os-columna-monto">
          {e.dias !== null
            ? enDias(e.dias)
            : e.diasEsperando !== null
              ? `esperando ${enDias(e.diasEsperando)}`
              : ''}
        </span>
      </div>
    </article>
  );
}

export default function Reparto({
  sinAsignar,
  asignadas,
  evaluadoras,
}: {
  sinAsignar: Evaluacion[];
  asignadas: Evaluacion[];
  evaluadoras: string[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lo que ya se movió en pantalla y todavía no confirmó el servidor.
   *
   * Sin esto la tarjeta se queda en la columna vieja hasta que contesta
   * Airtable o Supabase y recién ahí salta, que es medio segundo en el que
   * parece que el arrastre no hizo nada. Acá se mueve al soltar y el guardado
   * confirma después; si falla, vuelve sola y aparece el motivo.
   */
  const [movidas, setMovidas] = useState<
    Record<string, { evaluadora: string | null; etapa: string }>
  >({});

  const todas = useMemo(() => {
    const porId = new Map<string, Evaluacion>();
    for (const e of [...sinAsignar, ...asignadas]) porId.set(e.id, e);
    return [...porId.values()].map((e) =>
      movidas[e.id] ? { ...e, ...movidas[e.id] } : e
    );
  }, [sinAsignar, asignadas, movidas]);

  // Una vez que el servidor devuelve la fila donde la dejamos, el movimiento
  // deja de ser una promesa y se borra. Comparar antes de borrar evita el
  // parpadeo de soltarla justo cuando llega una respuesta vieja.
  useEffect(() => {
    const llegadas = [...sinAsignar, ...asignadas];
    setMovidas((previas) => {
      const quedan: typeof previas = {};
      for (const [id, m] of Object.entries(previas)) {
        const real = llegadas.find((x) => x.id === id);
        const confirmada =
          real && (real.evaluadora ?? null) === m.evaluadora && real.etapa === m.etapa;
        if (!confirmada) quedan[id] = m;
      }
      return Object.keys(quedan).length === Object.keys(previas).length
        ? previas
        : quedan;
    });
  }, [sinAsignar, asignadas]);

  async function repartir(id: string, evaluadora: string | null) {
    setError(null);
    const fila = todas.find((x) => x.id === id);
    if (!fila) return;
    if ((fila.evaluadora ?? null) === evaluadora) return;

    // Asignar mueve a Por citar; devolver a sin dueño la manda de vuelta.
    const cambios: Record<string, string | null> = { evaluadora };
    if (evaluadora && fila.etapa === 'Sin asignar') cambios.etapa = 'Por citar';
    if (!evaluadora && fila.etapa === 'Por citar') cambios.etapa = 'Sin asignar';

    const destino = { evaluadora, etapa: cambios.etapa ?? fila.etapa };
    mover(() => setMovidas((m) => ({ ...m, [id]: destino })));

    function devolver(motivo: string) {
      setMovidas((m) => {
        const { [id]: _, ...resto } = m;
        return resto;
      });
      setError(motivo);
    }

    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        devolver(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      devolver('No se pudo guardar.');
    }
  }

  function columna(clave: string, titulo: string, filas: Evaluacion[]) {
    return (
      <div
        key={clave}
        className={`os-columna${encima === clave ? ' encima' : ''}`}
        onDragOver={(ev) => {
          ev.preventDefault();
          setEncima(clave);
        }}
        onDragLeave={() => setEncima((v) => (v === clave ? null : v))}
        onDrop={(ev) => {
          ev.preventDefault();
          setEncima(null);
          const id = ev.dataTransfer.getData('text/plain');
          if (id) repartir(id, clave === SIN_DUENO ? null : clave);
        }}
      >
        <div className="os-columna-top">
          <span className="os-columna-titulo">{titulo}</span>
          <span className="os-columna-monto">{filas.length}</span>
        </div>
        {filas.map((e) => (
          <Tarjeta
            key={e.id}
            e={e}
            arrastrando={arrastrando === e.id}
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/plain', e.id);
              ev.dataTransfer.effectAllowed = 'move';
              setArrastrando(e.id);
            }}
            onDragEnd={() => setArrastrando(null)}
          />
        ))}

        {filas.length === 0 && (
          <p className="os-columna-vacia">
            {clave === SIN_DUENO ? 'Nada esperando' : 'Sin trabajo abierto'}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      <div
        className="os-kanban"
        style={{ gridTemplateColumns: `repeat(${evaluadoras.length + 1}, minmax(0, 1fr))` }}
      >
        {columna(
          SIN_DUENO,
          'Sin asignar',
          porEspera(todas.filter((e) => !e.evaluadora))
        )}

        {evaluadoras.map((nombre) =>
          columna(
            nombre,
            nombre,
            porEspera(
              todas.filter(
                (e) => (e.evaluadora ?? '').includes(nombre) && ABIERTAS.has(e.etapa)
              )
            )
          )
        )}
      </div>
    </>
  );
}
