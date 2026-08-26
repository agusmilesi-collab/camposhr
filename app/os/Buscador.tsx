'use client';

/**
 * Un campo que se escribe y va dejando lo que coincide.
 *
 * Con doce clientes un desplegable alcanzaba; con cincuenta hay que recorrerlo
 * entero para encontrar uno. Acá se escriben dos letras y quedan los que las
 * tienen: "ma" deja Macro Agro. Se busca sin acentos y en cualquier parte del
 * nombre, porque nadie recuerda cómo empieza exactamente el nombre cargado.
 *
 * **La lista aparece al escribir y no al entrar al campo.** El campo se toca
 * para escribir; desplegar los doce encima del formulario antes de la primera
 * letra tapa lo de abajo sin decir nada.
 *
 * **Lo que no está se puede dar de alta desde el mismo campo.** Escribir
 * "Carrefour" y que no aparezca nada no es un callejón: la última opción de la
 * lista lo toma como nombre nuevo. Cargar algo de un cliente que todavía no
 * existe es el caso de todos los días, no la excepción.
 *
 * Acá no hay campos ocultos ni formulario: quien lo usa decide qué hacer con lo
 * elegido, porque el alta de pedido manda el identificador de la empresa y el
 * embudo manda el nombre escrito.
 */

import { useEffect, useRef, useState } from 'react';

export type Sugerencia = { id: string; nombre: string };

/** Sin acentos y en minúsculas, para que "cofco" encuentre "Cofco". */
export function clave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export default function Buscador({
  opciones,
  alElegir,
  alCrear,
  alEscribir,
  inicial = '',
  placeholder,
  autoFocus = false,
  id,
  crear = (t) => (
    <>
      + Agregar <b>{t}</b> como cliente
    </>
  ),
}: {
  opciones: Sugerencia[];
  /** Se tomó una de la lista. */
  alElegir: (o: Sugerencia) => void;
  /** Se confirmó un nombre que no está en la lista. */
  alCrear: (nombre: string) => void;
  /** Cambió lo escrito sin confirmar nada todavía. */
  alEscribir?: (texto: string) => void;
  inicial?: string;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  /** Qué dice la última opción, la que toma lo escrito. */
  crear?: (texto: string) => React.ReactNode;
}) {
  const [texto, setTexto] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  const busca = clave(texto);
  const encontrados = busca ? opciones.filter((e) => clave(e.nombre).includes(busca)) : [];
  /**
   * Tomar lo escrito.
   *
   * Solo cuando no quedó ninguno: mientras la búsqueda encuentra algo, lo que
   * hace falta es elegir, y ofrecer "agregar" al lado de la coincidencia es
   * ruido. Dos letras de mínimo para no proponer un alta con lo que todavía se
   * está escribiendo.
   */
  const puedeCrear = busca.length >= 2 && encontrados.length === 0;
  const cuantas = encontrados.length + (puedeCrear ? 1 : 0);

  // Un clic afuera cierra la lista y deja lo que estaba elegido.
  useEffect(() => {
    function afuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, []);

  function tomar(e: Sugerencia) {
    setTexto(e.nombre);
    setAbierto(false);
    alElegir(e);
  }

  function nuevo(nombre: string) {
    setTexto(nombre);
    setAbierto(false);
    alCrear(nombre);
  }

  function alTeclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
      setMarcado((n) => {
        if (cuantas === 0) return 0;
        return (n + (e.key === 'ArrowDown' ? 1 : cuantas - 1)) % cuantas;
      });
      return;
    }
    if (e.key === 'Enter' && abierto && cuantas > 0) {
      // Enter elige de la lista y no manda el formulario a medio llenar.
      e.preventDefault();
      if (marcado < encontrados.length) tomar(encontrados[marcado]);
      else nuevo(texto.trim());
      return;
    }
    if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  return (
    <div className="os-buscar" ref={caja}>
      <input
        className="os-campo"
        id={id}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={texto}
        aria-expanded={abierto}
        aria-autocomplete="list"
        role="combobox"
        onChange={(e) => {
          setTexto(e.target.value);
          setMarcado(0);
          setAbierto(true);
          alEscribir?.(e.target.value);
        }}
        onKeyDown={alTeclado}
      />

      {/* La lista aparece al escribir y no al entrar al campo: desplegar los
          doce clientes sobre el formulario cada vez que alguien toca el campo
          tapa lo de abajo para no decir nada que no esté escribiendo. */}
      {abierto && busca.length > 0 && (
        <ul className="os-buscar-lista" role="listbox">
          {encontrados.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                className={`os-buscar-opcion${i === marcado ? ' os-buscar-marcada' : ''}`}
                role="option"
                aria-selected={i === marcado}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => tomar(e)}
              >
                {e.nombre}
              </button>
            </li>
          ))}

          {puedeCrear && (
            <li>
              <button
                type="button"
                className={`os-buscar-opcion os-buscar-crear${
                  marcado === encontrados.length ? ' os-buscar-marcada' : ''
                }`}
                onMouseEnter={() => setMarcado(encontrados.length)}
                onClick={() => nuevo(texto.trim())}
              >
                {crear(texto.trim())}
              </button>
            </li>
          )}

          {encontrados.length === 0 && !puedeCrear && (
            <li className="os-buscar-vacio">Escribí al menos dos letras.</li>
          )}
        </ul>
      )}
    </div>
  );
}
