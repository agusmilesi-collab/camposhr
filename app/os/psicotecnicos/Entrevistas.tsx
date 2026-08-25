'use client';

/**
 * Las entrevistas, en un tablero de tres columnas.
 *
 * Citar, entrevistar y analizar son tres etapas de la base y un solo trabajo:
 * el de la evaluadora con ese candidato, de punta a punta. Repartidas en dos
 * pantallas había que saltar de una a la otra para seguir a la misma persona, y
 * no se veía dónde se estaba juntando la cola.
 *
 * La etapa se cambia arrastrando, como en el reparto. Con una regla que no es
 * de la pantalla sino del trabajo: **a Agendadas no se entra sin fecha**. Una
 * entrevista agendada sin día es exactamente lo mismo que una sin agendar, y
 * antes eso lo impedía el botón "Agendar", que estaba apagado hasta cargarla.
 *
 * Cada columna tiene su tarjeta porque en cada una se mira otra cosa: al citar,
 * el teléfono y si ya se la contactó; agendada, cuándo cae y si es presencial;
 * al analizar, cuánto hace que espera el informe. Y cada una tiene su puerta:
 * el teléfono para escribir, la hoja de la entrevista para tomarla, la ficha
 * para escribir el informe.
 *
 * Tocar el cuerpo de la tarjeta abre los datos en el cajón de la derecha, igual
 * que en el reparto. Arrastrar y tocar conviven: el navegador no dispara el
 * clic cuando lo que hubo fue un arrastre.
 */

import Link from 'next/link';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { COLOR_ETAPA, COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';
import { desdeInput, diaDeLaSemana, fechaHora, haceCuanto, paraInput } from '@/lib/hora';
import Bateria from './Bateria';
import Candidato from './Candidato';
import Desplegable from '@/app/os/Desplegable';
import type { PedidoOpcion } from './Agregar';

type EtapaTablero = 'Por citar' | 'Por entrevistar' | 'Por analizar';

const COLUMNAS: { etapa: EtapaTablero; titulo: string; vacio: string }[] = [
  { etapa: 'Por citar', titulo: 'Por citar', vacio: 'Nadie esperando que lo citen' },
  { etapa: 'Por entrevistar', titulo: 'Agendadas', vacio: 'Sin entrevistas agendadas' },
  { etapa: 'Por analizar', titulo: 'Por analizar', vacio: 'Nada esperando análisis' },
];

function soloDigitos(t: string): string {
  return t.replace(/[^0-9]/g, '');
}

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
 * El orden de cada columna es el de su urgencia, y cada una la mide distinto.
 *
 * Por citar y Por analizar, por lo que esperaron: lo más viejo arriba. Las
 * agendadas, por cuándo caen: lo que viene primero arriba, que es como se mira
 * una agenda.
 */
function ordenar(filas: Evaluacion[], etapa: EtapaTablero): Evaluacion[] {
  if (etapa === 'Por entrevistar') {
    return [...filas].sort((a, b) =>
      (a.fechaEntrevista ?? '9999').localeCompare(b.fechaEntrevista ?? '9999')
    );
  }
  return [...filas].sort((a, b) => {
    const espera = (x: Evaluacion) => x.dias ?? x.diasEsperando ?? -1;
    return espera(b) - espera(a) || a.nombre.localeCompare(b.nombre);
  });
}

/**
 * Una tarjeta del tablero.
 *
 * Vive fuera del componente a propósito: definida adentro, React la trata como
 * un tipo nuevo en cada dibujo y desmonta el subárbol entero. Eso borraba lo
 * escrito en el campo de fecha y se comía el clic en los botones, porque el
 * elemento que recibía el `mousedown` ya no existía al soltar.
 */
function Tarjeta({
  e,
  arrastrando,
  ocupada,
  onArrastrar,
  onSoltar,
  onAbrir,
  onGuardar,
  onEtapa,
}: {
  e: Evaluacion;
  arrastrando: boolean;
  ocupada: boolean;
  onArrastrar: (ev: React.DragEvent) => void;
  onSoltar: () => void;
  onAbrir: () => void;
  onGuardar: (campo: string, valor: unknown) => void;
  onEtapa: (etapa: EtapaTablero) => void;
}) {
  // Pasada la semana el análisis se está demorando.
  const demorada = e.etapa === 'Por analizar' && (e.dias ?? 0) > 7;

  return (
    <article
      className={`os-tarjeta-op${arrastrando ? ' arrastrando' : ''}`}
      style={{ viewTransitionName: `ficha-${e.id}` } as React.CSSProperties}
      draggable
      onDragStart={onArrastrar}
      onDragEnd={onSoltar}
    >
      {/* El cuerpo abre los datos; los controles de abajo no, porque cada uno
          hace lo suyo. */}
      <div
        className="os-tarjeta-cuerpo"
        role="button"
        tabIndex={0}
        onClick={onAbrir}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            onAbrir();
          }
        }}
      >
        {/* El nombre adelante: acá la tarjeta es la persona con la que se va
            a trabajar, y la batería al lado dice qué hay que tomarle. La
            empresa y la búsqueda van abajo, que es el contexto y no el sujeto. */}
        <div className="os-tarjeta-cliente os-tabla-empresa">
          <span className="os-tabla-recorta">{e.nombre}</span>
          <span className="os-tabla-punto">·</span>
          <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
        </div>
        <div className="os-tarjeta-concepto">
          {e.empresa} · {e.puesto}
        </div>
      </div>

      {e.etapa === 'Por citar' && (
        <div className="os-tarjeta-trabajo">
          <div className="os-tarjeta-linea">
            {e.telefono ? (
              <a
                className="os-tarjeta-telefono"
                href={`https://wa.me/${soloDigitos(e.telefono)}`}
                target="_blank"
                rel="noreferrer"
                title="Escribir por WhatsApp"
              >
                {e.telefono}
              </a>
            ) : (
              <span className="os-dato-falta">sin teléfono</span>
            )}
            <button
              className={`os-boton os-boton-marcado os-sello-estado ${
                e.mensaje === 'Esperando respuesta' ? 'os-ambar' : 'os-gris'
              }`}
              disabled={ocupada}
              onClick={() =>
                onGuardar(
                  'mensaje',
                  e.mensaje === 'Esperando respuesta' ? 'Sin contactar' : 'Esperando respuesta'
                )
              }
              title={
                e.mensaje === 'Esperando respuesta'
                  ? 'Ya se la contactó. Tocar para volver atrás.'
                  : 'Todavía no se la contactó. Tocar para marcar que sí.'
              }
            >
              {e.mensaje === 'Esperando respuesta' ? 'Esperando' : 'Sin contactar'}
            </button>
          </div>
          <div className="os-tarjeta-linea">
            <input
              className="os-campo"
              type="datetime-local"
              defaultValue={paraInput(e.fechaEntrevista)}
              disabled={ocupada}
              onChange={(ev) => {
                const iso = desdeInput(ev.target.value);
                if (iso) onGuardar('fechaEntrevista', iso);
              }}
              aria-label={`Fecha de la entrevista de ${e.nombre}`}
            />
            <Desplegable
              valor={e.modalidad ?? ''}
              opciones={[
                { valor: '', texto: 'Sin definir' },
                { valor: 'Presencial', texto: 'Presencial' },
                { valor: 'Online', texto: 'Online' },
              ]}
              alElegir={(v) => onGuardar('modalidad', v || null)}
              deshabilitado={ocupada}
              etiqueta="Modalidad"
            />
          </div>
          <button
            className="os-boton os-boton-firme os-tarjeta-accion"
            disabled={ocupada || !e.fechaEntrevista}
            onClick={() => onEtapa('Por entrevistar')}
            title={e.fechaEntrevista ? '' : 'Primero poné la fecha de la entrevista.'}
          >
            Agendar
          </button>
        </div>
      )}

      {e.etapa === 'Por entrevistar' && (
        <div className="os-tarjeta-trabajo">
          <div className="os-tarjeta-linea">
            {/* El día adelante: en una agenda se busca primero qué día cae. */}
            <span className="os-tarjeta-cuando">
              {e.fechaEntrevista ? (
                `${diaDeLaSemana(e.fechaEntrevista)} ${fechaHora(e.fechaEntrevista)}`
              ) : (
                <span className="os-dato-falta">sin fecha</span>
              )}
            </span>
            <span className="os-columna-monto">{e.modalidad ?? 'sin definir'}</span>
          </div>
          {/* Lleva a la hoja en vez de dar la entrevista por tomada: la
              evaluación avanza sola cuando queda administrado el último test,
              y en la hoja está el botón para cerrarla antes. */}
          <Link
            className="os-boton os-boton-firme os-tarjeta-accion"
            href={`/os/psicotecnicos/entrevista/${e.id}`}
          >
            Entrevistar
          </Link>
        </div>
      )}

      {e.etapa === 'Por analizar' && (
        <div className="os-tarjeta-trabajo">
          <div className="os-tarjeta-linea">
            <span className={demorada ? 'os-dato-falta' : 'os-columna-monto'}>
              espera {haceCuanto(e.dias)}
            </span>
            {e.recomendacion ? (
              <span
                className={`os-sello-estado ${COLOR_RECOMENDACION[e.recomendacion] ?? 'os-gris'}`}
              >
                {e.recomendacion}
              </span>
            ) : (
              <span className="os-dato-falta">sin cerrar</span>
            )}
          </div>
          <Link
            className="os-boton os-boton-firme os-tarjeta-accion"
            href={`/os/psicotecnicos/ficha/${e.id}?desde=entrevistas`}
          >
            Analizar
          </Link>
        </div>
      )}
    </article>
  );
}

export default function Entrevistas({
  filas,
  evaluadoras,
  pedidos,
}: {
  filas: Evaluacion[];
  evaluadoras: string[];
  pedidos: PedidoOpcion[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirando, setMirando] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  /** Lo movido en pantalla que el servidor todavía no confirmó. */
  const [movidas, setMovidas] = useState<Record<string, Partial<Evaluacion>>>({});

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
          real &&
          Object.entries(m).every(([k, v]) => (real as Record<string, unknown>)[k] === v);
        if (!confirmada) quedan[id] = m;
      }
      return Object.keys(quedan).length === Object.keys(previas).length ? previas : quedan;
    });
  }, [filas]);

  /** Guarda un campo suelto de una tarjeta, sin moverla de columna. */
  async function guardar(id: string, campo: string, valor: unknown) {
    setError(null);
    setTrabajando(id);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: { [campo]: valor } }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) setError(r.motivo ?? 'No se pudo guardar.');
      else empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setTrabajando(null);
    }
  }

  async function cambiarEtapa(id: string, etapa: EtapaTablero) {
    setError(null);
    const fila = todas.find((x) => x.id === id);
    if (!fila || fila.etapa === etapa) return;

    // La única regla del tablero, y no es de la pantalla: agendada sin fecha no
    // es una entrevista agendada. Es la misma condición que apagaba el botón.
    if (etapa === 'Por entrevistar' && !fila.fechaEntrevista) {
      setError(`Primero poné la fecha de la entrevista de ${fila.nombre}.`);
      return;
    }

    mover(() => setMovidas((m) => ({ ...m, [id]: { etapa } })));

    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: { etapa } }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setMovidas((m) => {
          const { [id]: _, ...resto } = m;
          return resto;
        });
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setMovidas((m) => {
        const { [id]: _, ...resto } = m;
        return resto;
      });
      setError('No se pudo guardar.');
    }
  }

  const abierta = mirando ? todas.find((x) => x.id === mirando) : null;

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      <div className="os-kanban" style={{ '--os-columnas': 3 } as React.CSSProperties}>
        {COLUMNAS.map((c) => {
          const suyas = ordenar(
            todas.filter((e) => e.etapa === c.etapa),
            c.etapa
          );
          return (
            <div
              key={c.etapa}
              className={`os-columna${encima === c.etapa ? ' encima' : ''}`}
              onDragOver={(ev) => {
                ev.preventDefault();
                setEncima(c.etapa);
              }}
              onDragLeave={() => setEncima((v) => (v === c.etapa ? null : v))}
              onDrop={(ev) => {
                ev.preventDefault();
                setEncima(null);
                const id = ev.dataTransfer.getData('text/plain');
                if (id) cambiarEtapa(id, c.etapa);
              }}
            >
              <div className="os-columna-top">
                <span className={`os-columna-titulo os-sello-estado ${COLOR_ETAPA[c.etapa] ?? 'os-gris'}`}>
                  {c.titulo}
                </span>
                <span className="os-columna-monto">{suyas.length}</span>
              </div>
              {suyas.map((e) => (
                <Tarjeta
                  key={e.id}
                  e={e}
                  arrastrando={arrastrando === e.id}
                  ocupada={trabajando === e.id}
                  onArrastrar={(ev) => {
                    ev.dataTransfer.setData('text/plain', e.id);
                    ev.dataTransfer.effectAllowed = 'move';
                    setArrastrando(e.id);
                  }}
                  onSoltar={() => setArrastrando(null)}
                  onAbrir={() => setMirando(e.id)}
                  onGuardar={(campo, valor) => guardar(e.id, campo, valor)}
                  onEtapa={(etapa) => cambiarEtapa(e.id, etapa)}
                />
              ))}
              {suyas.length === 0 && <p className="os-columna-vacia">{c.vacio}</p>}
            </div>
          );
        })}
      </div>

      {abierta && (
        <Candidato
          e={abierta}
          pedidos={pedidos}
          evaluadoras={evaluadoras}
          onCerrar={() => setMirando(null)}
        />
      )}
    </>
  );
}
