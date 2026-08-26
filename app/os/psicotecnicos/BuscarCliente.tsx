'use client';

/**
 * El cliente del pedido: se escribe, no se despliega.
 *
 * Con doce clientes un desplegable alcanzaba; con cincuenta hay que recorrerlo
 * entero para encontrar uno. Acá se escriben dos letras y quedan los que las
 * tienen: "ma" deja Macro Agro. Se busca sin acentos y en cualquier parte del
 * nombre, porque nadie recuerda cómo empieza exactamente el nombre cargado.
 *
 * **Lo que no está se puede dar de alta desde el mismo campo.** Escribir
 * "Carrefour" y que no aparezca nada no es un callejón: la última opción de la
 * lista lo abre como cliente nuevo. Cargar el pedido de un cliente que todavía
 * no existe es el caso de todos los días, no la excepción.
 *
 * Emite dos campos ocultos, que es lo que el formulario manda: `empresaId`
 * cuando se eligió uno de la lista y `empresaNueva` cuando se está dando de
 * alta. Nunca los dos.
 */

import { useEffect, useRef, useState } from 'react';
import type { Opcion } from './Agregar';

/** Sin acentos y en minúsculas, para que "cofco" encuentre "Cofco". */
function clave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function BuscarCliente({
  empresas,
  autoFocus = false,
}: {
  empresas: Opcion[];
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  /** El de la lista, si se eligió uno. */
  const [elegido, setElegido] = useState<Opcion | null>(null);
  /** El nombre del que se está dando de alta, si es uno nuevo. */
  const [nuevo, setNuevo] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const busca = clave(texto);
  const encontrados = busca
    ? empresas.filter((e) => clave(e.nombre).includes(busca))
    : empresas;
  /**
   * Dar de alta lo escrito.
   *
   * Solo cuando no quedó ninguno: mientras la búsqueda encuentra algo, lo que
   * hace falta es elegir, y ofrecer "agregar" al lado de la coincidencia es
   * ruido. Dos letras de mínimo para no proponer un alta con lo que todavía se
   * está escribiendo.
   */
  const puedeCrear = busca.length >= 2 && encontrados.length === 0;
  const opciones = encontrados.length + (puedeCrear ? 1 : 0);

  // Un clic afuera cierra la lista y deja lo que estaba elegido.
  useEffect(() => {
    function afuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, []);

  function tomar(e: Opcion) {
    setElegido(e);
    setNuevo(null);
    setTexto(e.nombre);
    setAbierto(false);
  }

  function crear(nombre: string) {
    setNuevo(nombre);
    setElegido(null);
    setTexto(nombre);
    setAbierto(false);
  }

  function alTeclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
      setMarcado((n) => {
        if (opciones === 0) return 0;
        return (n + (e.key === 'ArrowDown' ? 1 : opciones - 1)) % opciones;
      });
      return;
    }
    if (e.key === 'Enter' && abierto && opciones > 0) {
      // Enter elige de la lista y no manda el formulario a medio llenar.
      e.preventDefault();
      if (marcado < encontrados.length) tomar(encontrados[marcado]);
      else crear(texto.trim());
      return;
    }
    if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  return (
    <div className="os-buscar" ref={caja}>
      <input type="hidden" name="empresaId" value={elegido?.id ?? ''} />
      <input type="hidden" name="empresaNueva" value={nuevo ?? ''} />

      <input
        className="os-campo"
        id="empresaId"
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Escribí el nombre del cliente"
        value={texto}
        aria-expanded={abierto}
        aria-autocomplete="list"
        role="combobox"
        onChange={(e) => {
          setTexto(e.target.value);
          setElegido(null);
          setNuevo(null);
          setMarcado(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclado}
      />

      {abierto && (
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
                onClick={() => crear(texto.trim())}
              >
                + Agregar <b>{texto.trim()}</b> como cliente
              </button>
            </li>
          )}

          {encontrados.length === 0 && !puedeCrear && (
            <li className="os-buscar-vacio">Escribí al menos dos letras.</li>
          )}
        </ul>
      )}

      {nuevo && (
        <span className="os-form-nota">
          Se da de alta <b>{nuevo}</b> junto con el pedido.
        </span>
      )}
    </div>
  );
}
