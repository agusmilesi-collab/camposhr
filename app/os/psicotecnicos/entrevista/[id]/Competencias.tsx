'use client';

/**
 * Lo que la evaluadora escribe de la entrevista por competencias.
 *
 * Es el único test de la batería que no deja más rastro que su redacción, y se
 * escribe en la sala: por eso el campo está acá, entre los demás tests de la
 * hoja, y no en la ficha, que se lee después para codificar. Hasta ahora esa
 * redacción vivía en un Google Docs por candidato, fuera del sistema, y para
 * escribir el informe había que ir a buscarla.
 *
 * **Se escribe con formato**, porque reemplaza un documento: títulos, negrita,
 * cursiva, subrayado y listas, que es lo que se usa para separar competencia
 * por competencia. Se pone con la barra o con los atajos del sistema (⌘B, ⌘I,
 * ⌘U), que funcionan solos en un campo editable.
 *
 * **Lo que se pega entra sin formato.** Pegar de un documento arrastra tipos de
 * letra, tamaños y colores que después hay que limpiar a mano, y nada de eso
 * sobrevive al guardado: se pega el texto y se le da formato acá.
 *
 * **Se guarda al soltar el campo**, como las observaciones del papel: un texto
 * largo que se escribe de a ratos con un botón al pie se pierde el día que
 * alguien cierra la pestaña sin apretarlo. El botón está igual, porque acá se
 * escribe mientras se habla y ver que quedó guardado es lo que da tranquilidad
 * para seguir.
 *
 * **El contenido del campo no lo maneja React.** Un `contenteditable` cuyo
 * contenido React administra se vacía en cada dibujo: lo que se acaba de
 * escribir dispara un dibujo, y en ese dibujo React vuelve a poner lo que él
 * cree que hay adentro, que es lo que había al montarlo. Acá el nodo se declara
 * sin hijos, así que React no lo toca nunca, y lo guardado se escribe una vez
 * desde un efecto.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { comoHtml, limpiarHtml, tieneTexto } from '@/lib/texto-rico';
import { soloHora } from '@/lib/hora';

/** Los botones de la barra, con el comando del navegador que ejecuta cada uno. */
const FORMATOS = [
  { comando: 'bold', texto: 'N', titulo: 'Negrita (⌘B)', clase: 'os-formato-negrita' },
  { comando: 'italic', texto: 'C', titulo: 'Cursiva (⌘I)', clase: 'os-formato-cursiva' },
  { comando: 'underline', texto: 'S', titulo: 'Subrayado (⌘U)', clase: 'os-formato-subrayado' },
] as const;

/** Las listas van aparte: cambian el renglón entero, no las palabras marcadas. */
const LISTAS = [
  { comando: 'insertUnorderedList', texto: '• Lista', titulo: 'Lista con viñetas' },
  { comando: 'insertOrderedList', texto: '1. Lista', titulo: 'Lista numerada' },
] as const;

/** Todos los comandos que prenden un botón, para preguntar por ellos de una. */
const COMANDOS = [...FORMATOS, ...LISTAS].map((f) => f.comando);

/**
 * Los tamaños de renglón, del más grande al normal.
 *
 * Lo que se elige es qué es el renglón y no cuántos píxeles mide: un título de
 * competencia es un título, y el tamaño con el que se ve acá y el que use el
 * informe pueden ser distintos sin que nadie tenga que volver a tocarlo.
 */
const TAMANOS = [
  { etiqueta: 'h3', texto: 'Título' },
  { etiqueta: 'h4', texto: 'Subtítulo' },
  { etiqueta: 'p', texto: 'Texto' },
] as const;

/** Un botón de la barra. Los dos grupos dibujan el mismo. */
function Boton({
  f,
  activos,
  formatear,
}: {
  f: { comando: string; texto: string; titulo: string; clase?: string };
  activos: string[];
  formatear: (comando: string, valor?: string) => void;
}) {
  const puesto = activos.includes(f.comando);
  return (
    <button
      type="button"
      className={`os-formato-boton ${f.clase ?? ''}${puesto ? ' os-formato-activo' : ''}`}
      title={f.titulo}
      aria-pressed={puesto}
      // Con el ratón apretado el campo pierde el foco y la selección se
      // deshace: el formato se aplicaría sobre nada.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => formatear(f.comando)}
    >
      {f.texto}
    </button>
  );
}

export default function Competencias({
  id,
  texto,
}: {
  id: string;
  texto: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const campo = useRef<HTMLDivElement>(null);
  /** La caja entera: la barra y el campo. Sirve para saber si el foco sigue acá. */
  const editor = useRef<HTMLDivElement>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Qué formatos tiene la selección de ahora, para prender los botones. */
  const [activos, setActivos] = useState<string[]>([]);
  /** Qué tamaño tiene el renglón donde está el cursor. */
  const [tamano, setTamano] = useState('p');
  /** Cambia cuando se escribe: es lo que vuelve a preguntar si hay pendiente. */
  const [tecleos, setTecleos] = useState(0);
  /** A qué hora entró lo último que se cargó, mientras dure la pantalla. */
  const [cargadoA, setCargadoA] = useState<string | null>(null);

  const guardado = limpiarHtml(comoHtml(texto));

  // Lo guardado se escribe en el campo al montarlo y cada vez que el servidor
  // manda otra cosa: guardar redibuja, y volver a lo de antes desde otra
  // pantalla tiene que verse acá. Mientras el servidor mande lo mismo, no se
  // toca, o borraría lo que se está escribiendo.
  useEffect(() => {
    if (campo.current && campo.current.innerHTML !== guardado) {
      campo.current.innerHTML = guardado;
      setTecleos((n) => n + 1);
    }
  }, [guardado]);

  // Chrome separa los renglones con `div` y deja la primera línea suelta, fuera
  // de todo bloque. Con `p` cada renglón es un párrafo desde el principio, que
  // es lo que hace que "esto es un subtítulo" tenga dónde empezar y terminar.
  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }, []);

  useEffect(() => {
    const mirar = () => {
      if (!campo.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      setActivos(COMANDOS.filter((c) => document.queryCommandState(c)));
      const bloque = document.queryCommandValue('formatBlock').toLowerCase();
      setTamano(TAMANOS.some((t) => t.etiqueta === bloque) ? bloque : 'p');
    };
    document.addEventListener('selectionchange', mirar);
    return () => document.removeEventListener('selectionchange', mirar);
  }, []);

  /** Lo escrito, con el mismo criterio con el que lo va a guardar la ruta. */
  const escrito = () => limpiarHtml(campo.current?.innerHTML ?? '');

  // `tecleos` no se usa acá, pero es lo que hace que esto se vuelva a calcular:
  // el campo lo maneja el navegador y React no se entera de que cambió.
  void tecleos;
  const pendiente = campo.current !== null && escrito() !== guardado;
  const vacio = campo.current ? !tieneTexto(campo.current.innerHTML) : !tieneTexto(guardado);
  // Reemplaza un documento, y en un documento se mira cuánto se lleva escrito.
  const palabras = (campo.current?.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;

  function formatear(comando: string, valor?: string) {
    campo.current?.focus();
    document.execCommand(comando, false, valor);
    setActivos(COMANDOS.filter((c) => document.queryCommandState(c)));
    setTecleos((n) => n + 1);
  }

  async function guardar() {
    if (!pendiente) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/entrevista-competencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, texto: escrito() }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      // En la hora del trabajo y de veinticuatro, como el resto del OS.
      setCargadoA(soloHora(new Date().toISOString()));
      empezar(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="os-herramienta-accion">
        {/* El estado sale de si hay algo escrito: no hay marca de administrado
            que poner aparte, porque el test es lo escrito. */}
        <span className={`os-sello-estado ${tieneTexto(texto) ? 'os-verde' : 'os-gris'}`}>
          {tieneTexto(texto) ? 'Escrita' : 'Sin escribir'}
        </span>
        <span />
        <span />
      </div>

      <div className="os-competencias">
        {/* La barra y el campo son una sola caja con un borde: separados se
            leían como dos controles, y la barra no se entendía de quién era. */}
        <div className="os-editor" ref={editor}>
          <div className="os-formato-barra">
            {/* El tamaño va en un cajón y no en botones: son tres opciones que
                se excluyen, y el cajón dice cuál rige sin tener que mirar cuál
                de tres está prendido. */}
            <select
              className="os-formato-tamano"
              value={tamano}
              aria-label="Tamaño del renglón"
              title="Qué es este renglón"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => formatear('formatBlock', `<${e.target.value}>`)}
            >
              {TAMANOS.map((t) => (
                <option key={t.etiqueta} value={t.etiqueta}>
                  {t.texto}
                </option>
              ))}
            </select>

            {/* Dos grupos separados: lo que cambia las palabras marcadas y lo
                que cambia el renglón entero. Los cinco seguidos se apretaban
                como si hicieran todos lo mismo. */}
            <div className="os-formato-grupo">
              {FORMATOS.map((f) => (
                <Boton key={f.comando} f={f} activos={activos} formatear={formatear} />
              ))}
            </div>
            <div className="os-formato-grupo">
              {LISTAS.map((f) => (
                <Boton key={f.comando} f={f} activos={activos} formatear={formatear} />
              ))}
            </div>
          </div>

          <div
            ref={campo}
            className={`os-campo os-campo-rico${vacio ? ' os-campo-vacio' : ''}`}
            contentEditable
            suppressContentEditableWarning
            // La tarjeta se arrastra para reordenar los tests: sin esto,
            // marcar una palabra con el ratón arranca el arrastre de la
            // tarjeta entera.
            draggable={false}
            onDragStart={(e) => e.stopPropagation()}
            role="textbox"
            aria-multiline="true"
            aria-label="Lo que se trabajó en la entrevista por competencias"
            data-vacio="Competencia por competencia: qué se preguntó, qué contestó y con qué situación lo respaldó."
            onInput={() => setTecleos((n) => n + 1)}
            onPaste={(e) => {
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }}
            // Elegir el tamaño en el desplegable saca el foco del campo. Sin
            // esta guarda eso disparaba el guardado, y la respuesta llegaba
            // con el texto de antes justo después de aplicar el formato: el
            // campo se redibujaba con lo guardado y el título recién puesto
            // desaparecía.
            onBlur={(e) => {
              if (editor.current?.contains(e.relatedTarget as Node | null)) return;
              guardar();
            }}
          />
        </div>

        {/* El pie dice de un lado en qué está lo escrito y del otro qué hacer
            con ello. El botón cierra contra el margen derecho del campo, que es
            donde se termina de escribir: al lado de una caja de doscientos
            píxeles quedaba a media altura y lejos de la última línea. */}
        <div className="os-competencias-pie">
          <span className="os-editor-cuenta">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : pendiente ? (
              'Sin cargar'
            ) : cargadoA ? (
              `Cargado a las ${cargadoA}`
            ) : (
              palabras > 0 && `${palabras} ${palabras === 1 ? 'palabra' : 'palabras'}`
            )}
          </span>
          <button
            className="os-boton os-boton-azul"
            type="button"
            disabled={guardando || !pendiente}
            onClick={() => guardar()}
          >
            {guardando ? 'Cargando…' : 'Cargar lo escrito'}
          </button>
        </div>
      </div>
    </>
  );
}
