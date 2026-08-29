'use client';

/**
 * El selector de un código del protocolo.
 *
 * Los códigos se reconocen por su color: el mismo que tienen en la tabla de
 * Airtable que la evaluadora viene usando, y el mismo que queda en la celda una
 * vez elegido. Con un `select` del navegador eso era imposible, porque no deja
 * pintar sus opciones: la lista salía en blanco y negro y el color aparecía
 * recién al elegir, que es cuando ya no hace falta.
 *
 * **Y se escribe para buscar.** Determinantes tiene veintiocho opciones y
 * contenidos más de treinta: recorrer una lista con el dedo cuesta más que
 * escribir "FM". Se filtra por lo que el código empieza y después por lo que
 * contiene, así "F" propone F antes que FMa, y las flechas y Enter alcanzan
 * para no soltar el teclado en todo el protocolo.
 *
 * La lista cuelga de `.os` con el mismo anclaje que el desplegable del OS
 * (`useAnclaje`): adentro de la tabla la recortarían la celda, el marco y el
 * panel, y en la última fila no se vería ninguna opción.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { anfitrion, useAnclaje } from '@/app/os/anclar';
import { tonoDe, type Opcion } from '@/lib/rorschach';

/** Lo que empieza con lo escrito primero, y después lo que lo contiene. */
function filtrar(opciones: Opcion[], busca: string): Opcion[] {
  const q = busca.trim().toLowerCase();
  if (!q) return opciones;
  const empieza = opciones.filter((o) => o.v.toLowerCase().startsWith(q));
  const contiene = opciones.filter(
    (o) => !o.v.toLowerCase().startsWith(q) && o.v.toLowerCase().includes(q)
  );
  return [...empieza, ...contiene];
}

export default function Codigo({
  valor,
  opciones,
  onElegir,
  etiqueta,
  buscable = true,
  ancho,
  /** Qué dibuja el botón cuando no hay nada elegido. */
  vacio = '—',
  /** El botón chico de agregar, para las celdas de varios códigos. */
  comoAgregar = false,
  /**
   * Cuántas opciones por fila.
   *
   * Sin esto se acomodan solas y llenan el ancho, que es lo que conviene con
   * treinta códigos de dos letras. La lámina va en filas de tres: son diez, van
   * en orden, y en tres columnas se busca la que se quiere por su lugar.
   */
  porFila,
  /**
   * Si se puede dejar la celda sin código.
   *
   * La lámina no: una respuesta siempre es de una lámina, y "sin código" ahí
   * sería un protocolo que no se puede leer.
   */
  sinVacio = false,
}: {
  valor?: string | null;
  opciones: Opcion[];
  onElegir: (v: string | null) => void;
  etiqueta: string;
  buscable?: boolean;
  ancho?: number;
  vacio?: string;
  comoAgregar?: boolean;
  porFila?: number;
  sinVacio?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [busca, setBusca] = useState('');
  const [marcada, setMarcada] = useState(0);
  const caja = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLSpanElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const sitio = useAnclaje(abierta, boton, lista, () => setAbierta(false));
  const visibles = useMemo(() => filtrar(opciones, busca), [opciones, busca]);

  /*
   * Al abrir, el foco va al campo y la marca al primero: se abre y se escribe,
   * sin un clic en el medio.
   *
   * El foco espera a que la lista tenga su lugar. Hasta entonces se dibuja con
   * `visibility: hidden` para no verla saltar, y un elemento oculto no se puede
   * enfocar: la llamada no fallaba, simplemente no hacía nada y había que
   * hacer clic en el campo para escribir.
   */
  useEffect(() => {
    if (!abierta) return;
    setBusca('');
    setMarcada(0);
  }, [abierta]);

  const enfocado = useRef(false);
  useEffect(() => {
    if (!abierta) {
      enfocado.current = false;
      return;
    }
    if (!buscable || !sitio || enfocado.current) return;
    enfocado.current = true;
    campo.current?.focus();
  }, [abierta, buscable, sitio]);

  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      const blanco = e.target as Node;
      if (!caja.current?.contains(blanco) && !lista.current?.contains(blanco)) setAbierta(false);
    };
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, [abierta]);

  function elegir(v: string | null) {
    setAbierta(false);
    onElegir(v);
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setAbierta(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setMarcada((m) => {
        const n = visibles.length;
        if (n === 0) return 0;
        return e.key === 'ArrowDown' ? (m + 1) % n : (m - 1 + n) % n;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const o = visibles[marcada];
      if (o) elegir(o.v);
    }
  }

  const desplegada = (
    <span
      className="os-codigos-lista"
      role="listbox"
      ref={lista}
      style={{
        position: 'fixed',
        top: sitio?.top ?? -9999,
        left: sitio?.left ?? -9999,
        visibility: sitio ? 'visible' : 'hidden',
      }}
    >
      {buscable && (
        <input
          ref={campo}
          className="os-codigos-buscar"
          value={busca}
          placeholder="Escribí para buscar"
          onChange={(e) => {
            setBusca(e.target.value);
            setMarcada(0);
          }}
          onKeyDown={teclado}
          aria-label={`Buscar en ${etiqueta}`}
        />
      )}
      <span
        className="os-codigos-opciones"
        style={
          porFila
            ? { display: 'grid', gridTemplateColumns: `repeat(${porFila}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {/* Sacar lo elegido va primero y sin color: no es un código más. */}
        {valor && !sinVacio && (
          <button
            type="button"
            className="os-codigos-vaciar"
            onClick={() => elegir(null)}
          >
            Sin código
          </button>
        )}
        {visibles.map((o, i) => (
          <button
            key={o.v}
            type="button"
            role="option"
            aria-selected={o.v === valor}
            className={`os-codigo-opcion${i === marcada ? ' marcada' : ''}${
              o.v === valor ? ' elegida' : ''
            }`}
            style={{ background: tonoDe(opciones, o.v) }}
            onMouseEnter={() => setMarcada(i)}
            onClick={() => elegir(o.v)}
          >
            {o.v}
          </button>
        ))}
        {visibles.length === 0 && <span className="os-codigos-nada">Ningún código con eso</span>}
      </span>
    </span>
  );

  return (
    <span className="os-codigo" ref={caja}>
      <button
        type="button"
        ref={boton}
        className={comoAgregar ? 'os-chip-agregar' : 'os-codigo-boton'}
        style={
          comoAgregar || !valor ? undefined : { background: tonoDe(opciones, valor) }
        }
        aria-haspopup="listbox"
        aria-expanded={abierta}
        onClick={() => setAbierta((x) => !x)}
        onKeyDown={(e) => {
          // Se abre escribiendo: la primera tecla ya es la búsqueda.
          if (!abierta && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            setAbierta(true);
            setTimeout(() => {
              if (campo.current) {
                campo.current.value = e.key;
                setBusca(e.key);
              }
            }, 0);
          }
        }}
        title={etiqueta}
        aria-label={etiqueta}
      >
        {comoAgregar ? '+' : (valor ?? vacio)}
      </button>

      {abierta && anfitrion() && createPortal(desplegada, anfitrion() as Element)}
    </span>
  );
}
