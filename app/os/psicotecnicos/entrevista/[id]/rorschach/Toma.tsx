'use client';

/**
 * El campo donde se anota lo que el candidato dice, en la primera instancia.
 *
 * Vive en dos lugares con el mismo código: adentro de la pantalla, y adentro de
 * la ventana flotante que se abre para no mostrarle a él lo que ella escribe.
 * Si fueran dos, la pared de las cuatro respuestas o el giro de la lámina se
 * arreglarían en uno y seguirían mal en el otro.
 */

import { GIRO, POSICION } from '@/lib/rorschach';

/** El siguiente cuarto de vuelta, en el sentido en que gira el botón. */
export function siguienteGiro(posicion: string): string {
  const orden = ['^', '<', 'v', '>'];
  return orden[(orden.indexOf(posicion) + 1) % orden.length] ?? '^';
}

/** Cómo se lee cada posición, para el título del botón. */
export const NOMBRE_POSICION: Record<string, string> = {
  '^': 'Derecha, como se le entrega',
  v: 'Invertida',
  '<': 'Girada a la izquierda',
  '>': 'Girada a la derecha',
};

export default function Toma({
  lamina,
  numero,
  texto,
  onTexto,
  onGuardar,
  guardando,
  llena,
  tomadas,
  onCorregir,
  onBorrar,
  borrando,
  onBorrando,
}: {
  lamina: string;
  numero: number;
  texto: string;
  onTexto: (v: string) => void;
  onGuardar: () => void;
  guardando: boolean;
  llena: boolean;
  /**
   * Lo que ya dijo en esta lámina, para tenerlo a la vista mientras habla.
   *
   * `n` es la cuenta de esta lámina, que es lo que se muestra; `nProtocolo` es
   * el número correlativo de todo el protocolo, que es con el que se guarda y
   * con el que se renumera al borrar.
   */
  tomadas?: {
    id?: string;
    n: number;
    nProtocolo?: number;
    texto: string;
    posicion: string | null;
  }[];
  /** Corregir lo escrito: se toma al vuelo y una palabra puede salir mal. */
  onCorregir?: (id: string, texto: string) => void;
  /** Sacar una respuesta entera. Lo que sigue se renumera. */
  onBorrar?: (id: string, n: number) => void;
  /** Cuál está esperando que confirmen su borrado. */
  borrando?: string | null;
  onBorrando?: (id: string | null) => void;
}) {
  return (
    <div className="os-ror-campo">
      {/* Lo que va diciendo, arriba del campo. Sin esto hay que acordarse de
          memoria de lo que ya dio en esta lámina, que es justo lo que no se
          puede hacer mientras se escucha la respuesta que sigue. */}
      {tomadas && tomadas.length > 0 && (
        <p className="os-ror-dichas-titulo">Respuestas lámina {lamina}</p>
      )}
      {tomadas && tomadas.length > 0 && (
        <ol className="os-ror-dichas">
          {tomadas.map((t) => (
            <li key={t.id ?? t.n}>
              {/* El número es el de la respuesta en el protocolo entero, no en
                  la lámina: es lo que cuenta el sumario y por eso sigue de
                  corrido de una lámina a la otra. */}
              <span className="os-ror-dichas-n">{t.n}</span>
              {/* Se escribe mientras la persona habla, así que se puede
                  corregir sin salir de acá: guarda al dejar el campo. */}
              {t.id && onCorregir ? (
                <input
                  className="os-campo os-ror-dichas-texto"
                  defaultValue={t.texto}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.texto) onCorregir(t.id as string, v);
                    else if (!v) e.target.value = t.texto;
                  }}
                  aria-label={`Respuesta ${t.n}`}
                />
              ) : (
                <span className="os-ror-dichas-texto">{t.texto}</span>
              )}
              {t.posicion && t.posicion !== '^' && (
                <span className="os-ror-dichas-giro" title={NOMBRE_POSICION[t.posicion]}>
                  {t.posicion}
                </span>
              )}
              {/* Borrarla entera. Pregunta una vez: es lo que la persona dijo y
                  no se puede volver a escuchar, y la cruz está al lado del campo
                  que se corrige todo el tiempo. */}
              {t.id && onBorrar && (
                borrando === t.id ? (
                  <span className="os-ror-dichas-confirma">
                    <button
                      type="button"
                      className="os-boton os-boton-fila os-boton-peligro"
                      /* Con el número del protocolo: es el que renumera lo
                         que sigue, y el de la lámina correría las que no van. */
                      onClick={() => onBorrar(t.id as string, t.nProtocolo ?? t.n)}
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      className="os-boton os-boton-fila"
                      onClick={() => onBorrando?.(null)}
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="os-ror-dichas-x"
                    onClick={() => onBorrando?.(t.id as string)}
                    aria-label={`Borrar la respuesta ${t.n}`}
                    title="Borrar esta respuesta"
                  >
                    ×
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
      )}
      {/* Con la lámina llena el campo no está, en vez de estar apagado: no hay
          una quinta respuesta que escribir, y un campo que se ve pero no acepta
          nada se lee como que algo falla. */}
      {!llena && (
        <input
          className="os-campo"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && texto.trim()) onGuardar();
          }}
          placeholder="Sus palabras, textuales"
          aria-label="Lo que dijo el candidato"
        />
      )}
      {/* Llena no dice nada: no hay campo donde escribir y las respuestas están
          todas a la vista, así que el aviso repetía lo que ya se ve. */}
      {!llena && (
        <div className="os-ror-campo-alto os-ror-campo-alto-solo">
          <button
            type="button"
            className="os-boton os-boton-fila os-boton-firme"
            disabled={!texto.trim() || guardando}
            onClick={onGuardar}
          >
            {guardando ? 'Guardando…' : `Guardar respuesta ${numero}`}
          </button>
        </div>
      )}
    </div>
  );
}

/** Los grados que hay que girar la lámina para verla como la vio el candidato. */
export function gradosDe(posicion: string | null): number {
  return GIRO[posicion ?? '^'] ?? 0;
}

/** Las cuatro posiciones, para quien quiera dibujarlas todas. */
export { POSICION };
