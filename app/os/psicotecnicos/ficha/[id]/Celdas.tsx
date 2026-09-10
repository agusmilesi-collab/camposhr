'use client';

/**
 * Las dos celdas de códigos del protocolo, las mismas en la ficha y en la
 * pantalla de captura.
 *
 * Viven acá y no adentro de una de las dos porque los códigos se reconocen por
 * su color y por dónde caen: si la evaluadora captura sobre la lámina y después
 * corrige en la ficha, la celda tiene que abrirse igual en los dos lados.
 */

import Codigo from './Codigo';
import { tonoDe, type Opcion } from '@/lib/rorschach';

/**
 * Una celda de un solo código.
 *
 * La lámina no se busca escribiendo: son diez opciones en orden y se eligen
 * mirando, así que ahí el campo de búsqueda sería un paso de más.
 */
export function Simple({
  valor,
  opciones,
  onCambio,
  etiqueta,
  buscable = true,
  porFila,
  sinVacio,
  anchoBoton,
  nuevaFilaAntesDe,
  todas,
  vacio,
}: {
  valor: string | null;
  opciones: Opcion[];
  onCambio: (v: string | null) => void;
  etiqueta: string;
  buscable?: boolean;
  porFila?: number;
  sinVacio?: boolean;
  anchoBoton?: number;
  nuevaFilaAntesDe?: string;
  todas?: Opcion[];
  vacio?: string;
}) {
  return (
    <span className="os-celda-select">
      <Codigo
        valor={valor}
        opciones={opciones}
        onElegir={onCambio}
        etiqueta={etiqueta}
        buscable={buscable}
        porFila={porFila}
        sinVacio={sinVacio}
        anchoBoton={anchoBoton}
        nuevaFilaAntesDe={nuevaFilaAntesDe}
        todas={todas}
        vacio={vacio}
      />
    </span>
  );
}

/**
 * Varios códigos en una celda.
 *
 * El desplegable agrega y cada etiqueta se saca con su cruz. Se eligió esto en
 * vez de una lista con control para elegir varios porque en una tabla de
 * veinticinco filas hay que ver lo cargado de un vistazo, no abrir cada celda.
 */
export function Multiple({
  valores,
  opciones,
  onCambio,
  etiqueta,
}: {
  valores: string[];
  opciones: Opcion[];
  onCambio: (v: string[]) => void;
  etiqueta: string;
}) {
  return (
    <div className="os-celda-multiple">
      {valores.map((v) => (
        <span key={v} className="os-chip" style={{ background: tonoDe(opciones, v) }}>
          {v}
          <button
            type="button"
            className="os-chip-quitar"
            onClick={() => onCambio(valores.filter((x) => x !== v))}
            aria-label={`Quitar ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <Codigo
        opciones={opciones.filter((o) => !valores.includes(o.v))}
        onElegir={(v) => {
          if (v && !valores.includes(v)) onCambio([...valores, v]);
        }}
        etiqueta={etiqueta}
        comoAgregar
      />
    </div>
  );
}
