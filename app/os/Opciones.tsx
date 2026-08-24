'use client';

/**
 * La botonera de opciones del OS: una sola, para todas las pantallas.
 *
 * Dos o tres opciones que se excluyen y se eligen de un toque, en una píldora
 * donde todas miden lo mismo. Sirve para lo que se contesta mirando: cómo es el
 * puesto, si la persona ingresó, cómo se leen dos cuadrantes del Benziger.
 *
 * **Cuándo va esto y cuándo el desplegable.** Acá las opciones están a la vista
 * y se comparan entre sí, que es lo que hace falta cuando son pocas y la
 * pregunta se contesta eligiendo entre ellas. El desplegable (`Desplegable`) es
 * para lo que tiene muchos valores o se reconoce por su punto de color.
 *
 * Estaba escrito tres veces con el mismo markup: en el seguimiento, en las
 * preguntas del pedido y en el Benziger. Tres copias del mismo botón terminan
 * con tres tamaños distintos.
 */

export default function Opciones<T extends string | boolean | null>({
  valor,
  opciones,
  alElegir,
  desactivado,
  etiqueta,
}: {
  valor: T;
  opciones: { v: T; texto: string }[];
  alElegir: (v: T) => void;
  desactivado?: boolean;
  /** Qué pregunta contesta, para el lector de pantalla. */
  etiqueta?: string;
}) {
  return (
    <div
      className="os-ingreso-opciones"
      role="group"
      aria-label={etiqueta}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, 1fr)` }}
    >
      {opciones.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`os-ingreso-opcion${valor === o.v ? ' puesta' : ''}`}
          disabled={desactivado}
          onClick={() => alElegir(o.v)}
          aria-pressed={valor === o.v}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}
