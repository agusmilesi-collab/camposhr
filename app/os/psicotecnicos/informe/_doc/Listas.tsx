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

/**
 * Un ítem del borrador.
 *
 * Lleva un número propio y no se identifica por su posición: la posición cambia
 * en cada arrastre, y con ella React reusaría el renglón equivocado, que es
 * además contra qué se compara para animar el movimiento.
 */
type Item = { id: number; texto: string };

/** Cuánto dura el reacomodo de los renglones. */
const ANIMACION = 190;

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
  const [borrador, setBorrador] = useState<Item[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuál se está arrastrando. En una referencia y no en estado: cambia en cada
  // `dragover` y volver a dibujar por eso corta el arrastre en Firefox.
  const tomado = useRef<number | null>(null);
  const [movido, setMovido] = useState<number | null>(null);
  const caja = useRef<HTMLUListElement | null>(null);
  /** Si el gesto arrancó en el agarre. Ver el comentario del `dragstart`. */
  const desdeAgarre = useRef(false);
  const numerador = useRef(0);
  /**
   * Dónde estaba cada renglón justo antes de que la lista cambiara.
   *
   * Es la primera mitad del reacomodo: se mide antes de tocar el estado y se
   * compara con dónde quedó, para animar el recorrido en vez de que los
   * renglones salten de lugar. Se llena solo cuando algo los va a mover, así
   * que escribir no dispara ninguna animación.
   */
  const antes = useRef(new Map<number, number>());

  function envolver(textos: string[]): Item[] {
    return textos.map((texto) => ({ id: numerador.current++, texto }));
  }

  function abrir() {
    setBorrador(envolver(items.length ? items : ['']));
    setError(null);
    setEditando(true);
  }

  /** Guarda dónde está cada renglón ahora, incluido lo que esté animándose. */
  function medir() {
    const filas = caja.current?.children;
    if (!filas) return;
    antes.current.clear();
    for (const fila of Array.from(filas) as HTMLElement[]) {
      antes.current.set(Number(fila.dataset.id), fila.getBoundingClientRect().top);
    }
  }

  /**
   * Los renglones se reacomodan con una animación, y se vuelven a medir.
   *
   * Dos cosas al mismo tiempo. Arrastrar no crea ni destruye cajas de texto:
   * les cambia el contenido, y midiendo solo al montarse el ítem largo que
   * subía aparecía cortado a la mitad. Y donde quedó cada uno se compara con
   * dónde estaba: la diferencia se recorre en un pestañeo, así el orden nuevo
   * se entiende como un movimiento y no como un cambio de pantalla.
   */
  useLayoutEffect(() => {
    const marco = caja.current;
    if (!marco) return;
    const filas = Array.from(marco.children) as HTMLElement[];

    // La animación anterior se corta antes de medir: mientras corre, lo que
    // devuelve el navegador es la posición a mitad de camino y no la final.
    filas.forEach((f) => f.getAnimations().forEach((a) => a.cancel()));
    filas.forEach((f) => estirar(f.querySelector('textarea')));

    // Quien pidió que la pantalla no se mueva recibe el orden nuevo sin
    // recorrido: el reacomodo se ve igual, solo que ya hecho.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    filas.forEach((f) => {
      if (quieto) return;
      const desde = antes.current.get(Number(f.dataset.id));
      if (desde === undefined) return;
      const hasta = f.getBoundingClientRect().top;
      if (Math.abs(desde - hasta) < 0.5) return;
      f.animate(
        [{ transform: `translateY(${desde - hasta}px)` }, { transform: 'translateY(0)' }],
        { duration: ANIMACION, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
    });
    antes.current.clear();
  }, [borrador, editando]);

  function reordenar(desde: number, hasta: number) {
    if (desde === hasta) return;
    medir();
    setBorrador((lista) => {
      const copia = [...lista];
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
        {borrador.map((item, i) => (
          <li
            key={item.id}
            data-id={item.id}
            className={movido === i ? 'movido' : undefined}
            draggable
            /* El renglón entero es arrastrable, pero solo cuenta el gesto que
               empieza en el agarre: sin esto, arrastrar sobre las palabras del
               textarea para seleccionarlas movía el ítem de lugar. */
            onPointerDown={(ev) => {
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
            /**
             * El lugar se cede recién cuando el puntero pasa la mitad del
             * renglón vecino.
             *
             * Cediéndolo al tocarlo, los dos ítems se intercambian, el de
             * abajo queda otra vez bajo el puntero y vuelven a intercambiarse:
             * la lista tiembla sin avanzar. La mitad es también el punto donde
             * el ojo espera que el hueco se abra.
             */
            onDragOver={(ev) => {
              ev.preventDefault();
              const desde = tomado.current;
              if (desde === null || desde === i) return;
              const r = ev.currentTarget.getBoundingClientRect();
              const mitad = r.top + r.height / 2;
              if (desde > i ? ev.clientY > mitad : ev.clientY < mitad) return;
              reordenar(desde, i);
            }}
            /* Soltar termina acá y no en el documento: el arrastre lleva un
               texto, y sin frenarlo el navegador lo escribe adentro del campo
               sobre el que se suelta. Frenarlo también le dice que el destino
               era válido, así el renglón se queda donde lo dejaron en vez de
               volar de vuelta al lugar del que salió. */
            onDrop={(ev) => ev.preventDefault()}
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
              value={item.texto}
              rows={1}
              placeholder="Escribí el ítem"
              onChange={(ev) =>
                setBorrador((lista) =>
                  lista.map((x) => (x.id === item.id ? { ...x, texto: ev.target.value } : x))
                )
              }
            />
            <button
              type="button"
              className="inf-edita-quitar"
              title="Quitar este ítem"
              onClick={() => {
                medir();
                setBorrador((lista) => lista.filter((x) => x.id !== item.id));
              }}
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
          onClick={() =>
            setBorrador((lista) => [...lista, { id: numerador.current++, texto: '' }])
          }
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
            onClick={() => mandar(borrador.map((x) => x.texto.trim()).filter(Boolean))}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
