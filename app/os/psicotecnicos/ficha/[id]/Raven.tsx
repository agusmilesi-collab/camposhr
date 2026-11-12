'use client';

/**
 * El puntaje del Raven y lo que sale de él.
 *
 * Se carga el puntaje directo, que es la cantidad de aciertos sobre treinta y
 * seis, y el percentil, los desvíos y el rango se calculan solos. Los tres son
 * derivados: cargarlos a mano sería tres formas de equivocarse.
 *
 * El puntaje lo escribe el test cuando la persona lo termina por su enlace, y
 * no se carga a mano: acá se lee. Se cargaba a mano hasta el 16/9/2026, y un
 * guardado en blanco pisó un Raven rendido, con su tiempo y sus respuestas
 * guardados y ninguna corrección. Arriba se dice de dónde salió, porque un test
 * cortado por el reloj con láminas en blanco no se lee igual que uno entregado.
 *
 * Los cinco rangos se muestran enteros y con el suyo marcado. Un rango suelto
 * dice en qué cajón cayó la persona; la escala completa dice además qué tan
 * lejos quedó de los otros, que es lo que se necesita cuando hay que comparar
 * dos candidatos o explicarle el resultado a alguien.
 *
 */

import {
  calcularRaven,
  DESVIO,
  MEDIA,
  duracion,
  puntajesPorRango,
  RANGOS,
  RAVEN_MAXIMO,
  rangoDe,
  SIN_MEDICION,
  type Rango,
} from '@/lib/raven';
import { fechaHora } from '@/lib/hora';

export type Sesion = {
  iniciado_at: string | null;
  terminado_at: string | null;
  cierre: string | null;
  respuestas: Record<string, number> | null;
  /** De cuántas láminas era el enlace. Null en las sesiones viejas: 36. */
  laminas?: number | null;
};

/** Un decimal, escrito como se escribe en castellano. */
const coma = (n: number) => n.toFixed(1).replace('.', ',');

/**
 * De dónde salió el número que está cargado.
 *
 * El origen viene declarado por quien escribió, no deducido de si hay una
 * sesión: una evaluadora puede cargar a mano el puntaje de alguien que además
 * rindió por su enlace, y ahí la sesión existe pero el número no salió de ella.
 *
 * Cuando el puntaje es de la evaluadora y encima hay un test rendido, se dicen
 * los dos. Son dos mediciones de la misma persona y si no coinciden, eso es
 * justo lo que hay que ver.
 */
function Origen({
  origen,
  sesion,
  raw,
  tardo,
}: {
  origen: 'test' | 'manual' | null;
  sesion: Sesion | null;
  raw: number | null;
  tardo: number | null;
}) {
  if (raw === null) return null;
  const cuanto = duracion(tardo);

  const rindio = Boolean(sesion?.terminado_at);
  const respondidas = Object.keys(sesion?.respuestas ?? {}).length;
  const porTiempo = sesion?.cierre === 'tiempo';
  // Sin repetir que se lo tomó por su enlace ni cuánto tardó: las dos cosas
  // están arriba, en la cabecera de la tarjeta. Acá queda lo que no está en
  // ningún otro lado: cuándo terminó y cuántas láminas contestó.
  const total = sesion?.laminas === 12 ? 12 : RAVEN_MAXIMO;
  const comoCerro = `${fechaHora(sesion?.terminado_at ?? null)}, con ${respondidas} de ${total} láminas respondidas`;

  if (origen === 'test') {
    return (
      <span
        className={`os-raven-origen${porTiempo ? ' os-ambar' : ''}`}
        title={porTiempo ? `Se le acabó el tiempo${cuanto ? `, a los ${cuanto}` : ''}.` : undefined}
      >
        {comoCerro}
      </span>
    );
  }

  if (origen === 'manual') {
    return (
      <span className="os-raven-origen">
        Cargado a mano
        {rindio && ` · además rindió por su enlace: ${comoCerro}`}
      </span>
    );
  }

  // Filas anteriores a que se guardara el origen: no se sabe, y decir cualquiera
  // de los dos sería inventarlo.
  return <span className="os-raven-origen">Sin registro de cómo se cargó</span>;
}

export default function Raven({
  id,
  raw,
  corto = null,
  puedeSerDoce = false,
  percentil,
  desvios,
  resultado,
  origen,
  sesion,
  tardo,
  derecha,
  rangos = RANGOS,
}: {
  id: string;
  raw: number | null;
  /** Aciertos sobre 12, si rindió la serie corta. */
  corto?: number | null;
  /** Si la batería admite el de 12: sin enlace, todavía puede ser cualquiera. */
  puedeSerDoce?: boolean;
  percentil: number | null;
  desvios: number | null;
  resultado: string | null;
  origen: 'test' | 'manual' | null;
  sesion: Sesion | null;
  /** Segundos que tardó en responderlo. */
  tardo: number | null;
  /**
   * Lo que va contra el margen derecho de la línea del puntaje: en la hoja de
   * la entrevista, el reloj, lo que dio y el botón de copiar el enlace.
   */
  derecha?: React.ReactNode;
  /** Los cortes que rigen, que se pueden mover desde Configuración. */
  rangos?: Rango[];
}) {
  // Lo derivado se recalcula acá con los cortes que rigen: lo guardado nombra
  // el rango del día en que se midió.
  const enPantalla = calcularRaven(raw);
  const p = enPantalla?.percentil ?? percentil;
  const d = enPantalla?.desvios ?? desvios;
  const texto = enPantalla?.resultado ?? resultado ?? SIN_MEDICION;
  // Cuál de los cinco es el suyo, para marcarlo en la escala. Se busca por el
  // puntaje que hay en pantalla y no por el texto guardado: los cortes se
  // pueden mover, y el texto de una medición vieja nombra el rango de entonces.
  const enEscala = raw === null ? null : rangoDe(raw, rangos);
  const suyo =
    enEscala?.numeral ?? rangos.find((r) => texto.startsWith(`Rango ${r.numeral} ·`))?.numeral ?? null;
  const tramos = puntajesPorRango(rangos);

  // Lo del de 36 (sobre 36, percentil, desvíos, rangos) sale solo cuando se
  // sabe que es el de 36: tiene puntaje de 36, el enlace mandado es de 36, o
  // la batería no admite otro. En la Batería 1, sin enlace todavía puede ser
  // cualquiera de los dos; y la serie corta no
  // tiene baremo, así que se muestra su puntaje sobre 12 y nada que lo lea
  // como 36.
  const esDoce = typeof corto === 'number' || sesion?.laminas === 12;
  if (raw === null && (esDoce || (!sesion && puedeSerDoce))) {
    return (
      <div className="os-raven">
        <div className="os-raven-carga">
          <span className="os-raven-campo">
            <span className="os-dato-rotulo">
              {esDoce ? 'Puntaje directo · serie corta' : 'Puntaje directo'}
            </span>
            <span className="os-raven-entrada">
              <strong className="os-raven-directo">{corto ?? '—'}</strong>
              {esDoce && <span className="os-raven-sobre">de 12</span>}
            </span>
          </span>
          {derecha && <div className="os-raven-derecha">{derecha}</div>}
        </div>
        {typeof corto === 'number' && (
          <Origen origen={origen} sesion={sesion} raw={corto} tardo={tardo} />
        )}
        <div className="os-raven-glosario">
          <p>
            {esDoce
              ? 'El Raven de 12 láminas no tiene baremo propio: no da percentil ni rango.'
              : 'Todavía no se mandó el enlace. El percentil y el rango aparecen con el de 36.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="os-raven">
      <div className="os-raven-carga">
        {/* Se lee, no se escribe: el número lo pone el test al terminar. */}
        <span className="os-raven-campo">
          <span className="os-dato-rotulo">Puntaje directo</span>
          <span className="os-raven-entrada">
            <strong className="os-raven-directo">{raw ?? '—'}</strong>
            <span className="os-raven-sobre">de {RAVEN_MAXIMO}</span>
          </span>
        </span>

        <div className="os-raven-derivados">
          <span className="os-hoja-par">
            <span className="os-hoja-rotulo">Percentil</span>
            <span className="os-hoja-valor">{p ?? '—'}</span>
          </span>
          <span className="os-hoja-par">
            <span className="os-hoja-rotulo">Desvíos</span>
            <span className="os-hoja-valor">{d === null ? '—' : d.toFixed(1)}</span>
          </span>
        </div>

        {/* El reloj, el puntaje y el enlace contra el margen derecho de esta
            misma línea, debajo de la línea de la cabecera. */}
        {derecha && <div className="os-raven-derecha">{derecha}</div>}
      </div>

      {/* Cuándo terminó y cuántas contestó, debajo del puntaje y contra el
          margen izquierdo: es la letra chica del número que está arriba. */}
      <Origen origen={origen} sesion={sesion} raw={raw} tardo={tardo} />

      {/* La unidad va una vez, en el encabezado: repetir "aciertos" y "de cada
          cien candidatos" en las cinco filas era lo que hacía ancha la tabla. */}
      <ol className="os-raven-escala">
        <li className="os-raven-nivel os-raven-cabeza" aria-hidden="true">
          <span className="os-raven-numeral" />
          <span className="os-raven-nombre">Rango</span>
          <span className="os-raven-tramo">Aciertos</span>
          <span className="os-raven-frecuencia">Candidatos</span>
        </li>
        {rangos.map((r) => {
          const t = tramos.get(r.numeral);
          return (
            <li key={r.numeral} className={`os-raven-nivel${suyo === r.numeral ? ' suyo' : ''}`}>
              <span className="os-raven-numeral">{r.numeral}</span>
              <span className="os-raven-nombre">{r.nombre}</span>
              <span className="os-raven-tramo">{t ? `${t.desde} a ${t.hasta}` : '—'}</span>
              <span className="os-raven-frecuencia">
                {r.frecuencia.replace(/^1 de cada /, '1 cada ').replace(/ candidatos$/, '')}
              </span>
            </li>
          );
        })}
      </ol>

      {!suyo && <p className="os-raven-rango">{texto}</p>}

      {/* Tres líneas y no tres párrafos: lo que hay que saber para leer los dos
          números y de dónde salen. El detalle de la frecuencia de nuestros
          candidatos se lee en Configuración, que es donde se corrige. */}
      <div className="os-raven-glosario">
        {p !== null && d !== null ? (
          <>
            <p>
              <strong>Percentil {p}.</strong> De cada cien que rindieron, {Math.round(p)}{' '}
              sacaron menos puntos.
            </p>
            <p>
              <strong>
                Desvíos {d > 0 ? '+' : ''}
                {coma(d)}.
              </strong>{' '}
              {coma(Math.abs(d))} {d < 0 ? 'por debajo' : 'por encima'} del promedio de {String(MEDIA).replace('.', ',')}
              aciertos de los candidatos de Campos HR, y cada desvío son {String(DESVIO).replace('.', ',')}.
            </p>
          </>
        ) : (
          <p>
            El <strong>percentil</strong> dice cuántos de cada cien sacaron menos puntos; los{' '}
            <strong>desvíos</strong>, a qué distancia del promedio quedó.
          </p>
        )}
      </div>
    </div>
  );
}

