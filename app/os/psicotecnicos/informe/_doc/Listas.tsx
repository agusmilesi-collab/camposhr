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
import type { ListaDelInforme, Respaldo } from '@/lib/informe';
import { estirar } from '../../piezas';

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
export default function Listas({
  id,
  lista,
  items,
  intervenida,
  numerada = false,
  vacio,
  respaldos,
  grupo,
}: {
  /**
   * La evaluación, cuando la lista se puede editar.
   *
   * Sin esto la lista sale igual pero sin un solo control: es lo que reciben la
   * vista para imprimir y el portal del cliente.
   */
  id?: string;
  lista: ListaDelInforme;
  items: string[];
  intervenida: boolean;
  /** Las recomendaciones van numeradas; los tres grupos del análisis, no. */
  numerada?: boolean;
  vacio: string;
  /**
   * De qué índice salió cada texto, por el texto mismo.
   *
   * Solo llega desde la ficha: el documento lo pasa cuando recibe `editar`, así
   * que la vista para imprimir y el portal del cliente no lo tienen. Un texto
   * que la evaluadora corrigió no encuentra su respaldo y sale sin sello, que
   * es lo correcto: dejó de ser lo que dijo la codificación.
   */
  respaldos?: Record<string, Respaldo>;
  /**
   * Cuando la lista es uno de los tres grupos del análisis, su recuadro.
   *
   * El grupo lo dibuja este componente y no el documento porque el botón de
   * editar va arriba, en el encabezado, y el encabezado tiene que salir del
   * mismo lado que el estado que ese botón abre.
   */
  grupo?: { clave: string; titulo: string; sub: string };
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

  /**
   * El botón para entrar a editar, y el aviso de que la sección ya se tocó.
   *
   * Va arriba: es lo primero que se busca al llegar a la sección, y al pie de
   * una lista de seis oraciones hay que leerlas todas para encontrarlo.
   */
  const barra = id && !editando ? (
    <span className="inf-edita-barra">
      {intervenida && (
        <span className="inf-edita-marca" title="Esta sección no se recalcula">
          Editada a mano
        </span>
      )}
      <button type="button" className="os-boton" onClick={abrir}>
        Editar la lista
      </button>
    </span>
  ) : null;

  /** El grupo del análisis, con su encabezado; las recomendaciones van sueltas. */
  function envuelto(dentro: React.ReactNode) {
    // Las recomendaciones van en el mismo recuadro que los grupos, sin título
    // propio porque ya lo trae el capítulo. La cuenta sí: dice de un vistazo
    // con cuántas cosas se va el líder, igual que en los tres grupos.
    if (!grupo) {
      return (
        <section className="inf-grupo inf-grupo-liso">
          <div className="inf-grupo-top-der inf-grupo-solo-der">
            {barra}
            <span className="inf-grupo-cuantas">{items.length}</span>
          </div>
          {dentro}
        </section>
      );
    }
    return (
      <section className={`inf-grupo ${grupo.clave}`}>
        <header>
          <div>
            <h3>{grupo.titulo}</h3>
            <p className="inf-grupo-sub">{grupo.sub}</p>
          </div>
          <div className="inf-grupo-top-der">
            {barra}
            <span className="inf-grupo-cuantas">{items.length}</span>
          </div>
        </header>
        {dentro}
      </section>
    );
  }

  /**
   * El índice que respalda un texto, para quien evalúa.
   *
   * Va pegado al final del párrafo y no en una columna aparte: es la nota al pie
   * de esa oración, y en su propia columna obligaba a cruzar la vista para saber
   * cuál corresponde a cuál. Verde dentro de lo esperado y rojo cuando lo cruza,
   * los mismos colores que la hoja del sumario.
   */
  const sello = (texto: string) => {
    const r = respaldos?.[texto];
    if (!r) return null;
    const clase =
      r.dentro === null ? 'inf-respaldo-neutro' : r.dentro ? 'inf-respaldo-dentro' : 'inf-respaldo-fuera';
    // Hay lecturas que ya traen el índice adentro del valor ("W:M 9:3",
    // "EB 3:1.5 · ambigual"). Ahí se muestra el valor solo: repetirlo daba
    // sellos como "W:M W:M 9:3".
    const etiqueta = /[a-zA-Z]/.test(r.valor) ? r.valor : `${r.indice} ${r.valor}`;
    return (
      <span
        className={`inf-respaldo ${clase}`}
        title={r.esperado ? `${r.indice} esperado: ${r.esperado}` : `Sale de ${r.indice}`}
      >
        {etiqueta}
      </span>
    );
  };

  if (!editando) {
    return envuelto(
      items.length === 0 ? (
        <p className="inf-vacio">{vacio}</p>
      ) : numerada ? (
        <ol className="inf-recomendaciones">
          {items.map((t, i) => (
            <li key={i}>
              <span className="inf-orden">{String(i + 1).padStart(2, '0')}</span>
              <p>
                {t}
                {sello(t)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {items.map((t, i) => (
            <li key={i}>
              {t}
              {sello(t)}
            </li>
          ))}
        </ul>
      )
    );
  }

  return envuelto(
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
