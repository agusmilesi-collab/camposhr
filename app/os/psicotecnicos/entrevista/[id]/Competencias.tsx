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
 * **Se escribe con formato**, porque reemplaza un documento: negrita, cursiva y
 * listas, que es lo que se usa para separar competencia por competencia. El
 * formato se pone con la barra o con los atajos del sistema (⌘B, ⌘I), que
 * funcionan solos en un campo editable.
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

/** Los botones de la barra, con el comando del navegador que ejecuta cada uno. */
const FORMATOS = [
  { comando: 'bold', texto: 'N', titulo: 'Negrita (⌘B)', clase: 'os-formato-negrita' },
  { comando: 'italic', texto: 'C', titulo: 'Cursiva (⌘I)', clase: 'os-formato-cursiva' },
  { comando: 'insertUnorderedList', texto: '• Lista', titulo: 'Lista con viñetas', clase: '' },
  { comando: 'insertOrderedList', texto: '1. Lista', titulo: 'Lista numerada', clase: '' },
] as const;

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
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Qué formatos tiene la selección de ahora, para prender los botones. */
  const [activos, setActivos] = useState<string[]>([]);
  /** Cambia cuando se escribe: es lo que vuelve a preguntar si hay pendiente. */
  const [tecleos, setTecleos] = useState(0);

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

  useEffect(() => {
    const mirar = () => {
      if (!campo.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      setActivos(FORMATOS.map((f) => f.comando).filter((c) => document.queryCommandState(c)));
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

  function formatear(comando: string) {
    campo.current?.focus();
    document.execCommand(comando);
    setActivos(FORMATOS.map((f) => f.comando).filter((c) => document.queryCommandState(c)));
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
        <div className="os-formato-barra">
          {FORMATOS.map((f) => (
            <button
              key={f.comando}
              type="button"
              className={`os-formato-boton ${f.clase}${
                activos.includes(f.comando) ? ' os-formato-activo' : ''
              }`}
              title={f.titulo}
              aria-pressed={activos.includes(f.comando)}
              // Con el ratón apretado el campo pierde el foco y la selección se
              // deshace: el formato se aplicaría sobre nada.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatear(f.comando)}
            >
              {f.texto}
            </button>
          ))}
        </div>

        <div
          ref={campo}
          className={`os-campo os-campo-rico${vacio ? ' os-campo-vacio' : ''}`}
          contentEditable
          suppressContentEditableWarning
          // La tarjeta se arrastra para reordenar los tests: sin esto, marcar
          // una palabra con el ratón arranca el arrastre de la tarjeta entera.
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
          onBlur={() => guardar()}
        />

        {/* El botón cierra abajo y contra el margen derecho del campo, que es
            donde se termina de escribir. Al lado de una caja de doscientos
            píxeles quedaba flotando a media altura, lejos de la última línea. */}
        <div className="os-competencias-pie">
          {error && <span className="os-form-error">{error}</span>}
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
