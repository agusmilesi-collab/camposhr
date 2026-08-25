'use client';

/**
 * Una de las cuatro listas del informe, editable.
 *
 * El motor arma cada lista desde la codificación, y hasta acá eso era el final:
 * lo que salía era lo que se entregaba. La evaluadora ahora puede ordenar los
 * ítems, corregir una oración y sumar la suya, porque el que firma el informe
 * es quien tomó la entrevista y ve cosas que ningún índice trae.
 *
 * **Lo que ella deja escrito no se vuelve a calcular.** Guardada la lista, esa
 * sección queda suya aunque después cambie la codificación; por eso la marca de
 * intervenida y el botón para devolverla a lo calculado, que es la única forma
 * de volver atrás.
 *
 * Fuera del modo de edición dibuja exactamente el mismo marcado que dibujaba el
 * documento: acá se revisa el informe que se va a entregar, así que no puede
 * verse como un formulario mientras no se lo esté editando.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ListaDelInforme } from '@/lib/informe';

/** El renglón crece con lo que se escribe: un ítem puede ser un párrafo. */
function estirar(caja: HTMLTextAreaElement | null): void {
  if (!caja) return;
  caja.style.height = 'auto';
  caja.style.height = `${caja.scrollHeight}px`;
}

export default function Listas({
  id,
  lista,
  items,
  intervenida,
  numerada = false,
  vacio,
}: {
  id: string;
  lista: ListaDelInforme;
  items: string[];
  intervenida: boolean;
  numerada?: boolean;
  vacio: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<string[]>(items);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuál se está arrastrando. En una referencia y no en estado: cambia en cada
  // `dragover` y volver a dibujar por eso corta el arrastre en Firefox.
  const tomado = useRef<number | null>(null);
  const [movido, setMovido] = useState<number | null>(null);
  const caja = useRef<HTMLUListElement | null>(null);
  /** Si el gesto arrancó en el agarre. Ver el comentario del `dragstart`. */
  const desdeAgarre = useRef(false);

  /**
   * Los renglones se miden después de cada cambio, y no al montarse.
   *
   * Arrastrar no crea ni destruye renglones: mueve el texto de uno a otro. El
   * alto se quedaba en el del texto anterior, así que el ítem largo que subía
   * aparecía cortado a la mitad y el corto dejaba un renglón en blanco.
   */
  useLayoutEffect(() => {
    caja.current?.querySelectorAll('textarea').forEach(estirar);
  }, [borrador, editando]);

  function abrir() {
    setBorrador(items.length ? items : ['']);
    setError(null);
    setEditando(true);
  }

  function reordenar(desde: number, hasta: number) {
    if (desde === hasta) return;
    setBorrador((antes) => {
      const copia = [...antes];
      const [fuera] = copia.splice(desde, 1);
      copia.splice(hasta, 0, fuera);
      return copia;
    });
    tomado.current = hasta;
    setMovido(hasta);
  }

  async function mandar(cuerpo: string[] | null) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/informe-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lista, items: cuerpo }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <>
        {items.length === 0 ? (
          <p className="inf-vacio">{vacio}</p>
        ) : numerada ? (
          <ol className="inf-recomendaciones">
            {items.map((t, i) => (
              <li key={i}>
                <span className="inf-orden">{String(i + 1).padStart(2, '0')}</span>
                <p>{t}</p>
              </li>
            ))}
          </ol>
        ) : (
          <ul>
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
        <p className="inf-edita-barra">
          {intervenida && (
            <span className="inf-edita-marca" title="Esta sección no se recalcula">
              Editada a mano
            </span>
          )}
          <button type="button" className="os-boton" onClick={abrir}>
            Editar la lista
          </button>
        </p>
      </>
    );
  }

  return (
    <div className="inf-edita">
      <ul className="inf-edita-lista" ref={caja}>
        {borrador.map((t, i) => (
          <li
            key={i}
            className={movido === i ? 'movido' : undefined}
            draggable
            /* El renglón entero es arrastrable, pero solo cuenta el gesto que
               empieza en el agarre: sin esto, arrastrar sobre las palabras del
               textarea para seleccionarlas movía el ítem de lugar. */
            onMouseDown={(ev) => {
              desdeAgarre.current = Boolean(
                (ev.target as HTMLElement).closest('.inf-edita-agarre')
              );
            }}
            onDragStart={(ev) => {
              if (!desdeAgarre.current) {
                ev.preventDefault();
                return;
              }
              tomado.current = i;
              setMovido(i);
              ev.dataTransfer.effectAllowed = 'move';
              // Firefox no arranca el arrastre sin carga.
              ev.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              if (tomado.current !== null) reordenar(tomado.current, i);
            }}
            onDragEnd={() => {
              desdeAgarre.current = false;
              tomado.current = null;
              setMovido(null);
            }}
          >
            <span className="inf-edita-agarre" aria-hidden="true">
              ⠿
            </span>
            <textarea
              className="inf-edita-texto"
              value={t}
              rows={1}
              placeholder="Escribí el ítem"
              onChange={(ev) =>
                setBorrador((antes) => antes.map((x, j) => (j === i ? ev.target.value : x)))
              }
            />
            <button
              type="button"
              className="inf-edita-quitar"
              title="Quitar este ítem"
              onClick={() => setBorrador((antes) => antes.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {borrador.length === 0 && (
        <p className="inf-vacio">Sin ítems: la sección se entrega vacía.</p>
      )}

      {error && <p className="os-form-error">{error}</p>}

      <div className="inf-edita-pie">
        <button
          type="button"
          className="os-boton"
          onClick={() => setBorrador((antes) => [...antes, ''])}
        >
          Sumar un ítem
        </button>
        <div className="inf-edita-acciones">
          {intervenida && (
            <button
              type="button"
              className="os-boton"
              disabled={guardando}
              onClick={() => mandar(null)}
              title="Descarta lo escrito y vuelve a lo que sale de la codificación"
            >
              Volver a lo calculado
            </button>
          )}
          <button
            type="button"
            className="os-boton"
            disabled={guardando}
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="os-boton os-boton-firme"
            disabled={guardando}
            onClick={() => mandar(borrador.map((t) => t.trim()).filter(Boolean))}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
