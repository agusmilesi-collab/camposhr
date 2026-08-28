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
  apilada = false,
}: {
  valor: T;
  /**
   * `ayuda` es qué significa esa opción, y va debajo de su nombre.
   *
   * Lo usan las nueve preguntas del pedido, que la evaluadora le hace al
   * cliente por teléfono: "problemas mixtos" o "equipo fijo" se entienden
   * distinto en cada empresa, y la definición tiene que estar a la vista y no
   * detrás de pasar el mouse por encima. Con ayudas la botonera deja de ser una
   * pastilla y pasa a ser una fila de tarjetas.
   */
  opciones: { v: T; texto: string; ayuda?: string }[];
  alElegir: (v: T) => void;
  desactivado?: boolean;
  /** Qué pregunta contesta, para el lector de pantalla. */
  etiqueta?: string;
  /**
   * Una opción por renglón, en cuerpo chico.
   *
   * Para cuando la botonera acompaña a otra cosa en vez de ser la pregunta: al
   * lado de la cruz del Benziger, dos opciones en fila competían con los
   * cuadrantes, que son lo que ahí hay que mirar.
   */
  apilada?: boolean;
}) {
  const conAyuda = opciones.some((o) => o.ayuda);

  return (
    <div
      className={`os-ingreso-opciones${apilada ? ' apilada' : ''}${
        conAyuda ? ' con-ayuda' : ''
      }`}
      role="group"
      aria-label={etiqueta}
      style={apilada ? undefined : { gridTemplateColumns: `repeat(${opciones.length}, 1fr)` }}
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
          {o.ayuda ? (
            <>
              <span className="os-opcion-nombre">{o.texto}</span>
              <span className="os-opcion-ayuda">{o.ayuda}</span>
            </>
          ) : (
            o.texto
          )}
        </button>
      ))}
    </div>
  );
}
