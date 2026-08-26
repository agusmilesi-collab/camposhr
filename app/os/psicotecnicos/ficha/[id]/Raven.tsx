'use client';

/**
 * El puntaje del Raven y lo que sale de él.
 *
 * Se carga el puntaje directo, que es la cantidad de aciertos sobre treinta y
 * seis, y el percentil, los desvíos y el rango se calculan solos. Los tres son
 * derivados: cargarlos a mano sería tres formas de equivocarse.
 *
 * El puntaje entra por dos caminos y los dos son válidos: lo escribe el test
 * cuando la persona lo termina por su enlace, o lo carga la evaluadora cuando
 * el Raven se tomó en papel. Arriba se dice cuál de los dos fue, porque un
 * número sin origen no se puede discutir, y un test cortado por el reloj con
 * láminas en blanco no se lee igual que uno entregado.
 *
 * Los cinco rangos se muestran enteros y con el suyo marcado. Un rango suelto
 * dice en qué cajón cayó la persona; la escala completa dice además qué tan
 * lejos quedó de los otros, que es lo que se necesita cuando hay que comparar
 * dos candidatos o explicarle el resultado a alguien.
 *
 * Guarda al soltar el campo. Vaciarlo borra la medición, que no es lo mismo
 * que un cero: un cero es haber rendido y no acertar nada.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  calcularRaven,
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
  const comoCerro = `${porTiempo ? 'se le acabó el tiempo' : 'lo entregó'} el ${fechaHora(
    sesion?.terminado_at ?? null
  )}, con ${respondidas} de ${RAVEN_MAXIMO} láminas respondidas`;

  if (origen === 'test') {
    return (
      <span className={`os-raven-origen${porTiempo ? ' os-ambar' : ''}`}>
        Lo respondió por su enlace: {comoCerro}
        {cuanto && `, en ${cuanto}`}
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
  percentil,
  desvios,
  resultado,
  origen,
  sesion,
  tardo,
  rangos = RANGOS,
}: {
  id: string;
  raw: number | null;
  percentil: number | null;
  desvios: number | null;
  resultado: string | null;
  origen: 'test' | 'manual' | null;
  sesion: Sesion | null;
  /** Segundos que tardó en responderlo. */
  tardo: number | null;
  /** Los cortes que rigen, que se pueden mover desde Configuración. */
  rangos?: Rango[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(raw === null ? '' : String(raw));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que se ve mientras se escribe sale del mismo cálculo que el servidor va
  // a guardar: así el número no aparece un segundo después de escribirlo.
  const enPantalla = calcularRaven(valor === '' ? null : Number(valor));
  const p = enPantalla?.percentil ?? percentil;
  const d = enPantalla?.desvios ?? desvios;
  const texto = enPantalla?.resultado ?? resultado ?? SIN_MEDICION;
  // Cuál de los cinco es el suyo, para marcarlo en la escala. Se busca por el
  // puntaje que hay en pantalla y no por el texto guardado: los cortes se
  // pueden mover, y el texto de una medición vieja nombra el rango de entonces.
  const enEscala = valor === '' ? null : rangoDe(Number(valor), rangos);
  const suyo =
    enEscala?.numeral ?? rangos.find((r) => texto.startsWith(`Rango ${r.numeral} ·`))?.numeral ?? null;
  const tramos = puntajesPorRango(rangos);

  async function guardar(t: string) {
    if (t === (raw === null ? '' : String(raw))) return;
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/raven', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, raw: t === '' ? null : Number(t) }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-raven">
      <div className="os-raven-carga">
        <label className="os-raven-campo">
          <span className="os-dato-rotulo">Puntaje directo</span>
          <span className="os-raven-entrada">
            <input
              className="os-campo"
              type="number"
              min={0}
              max={RAVEN_MAXIMO}
              value={valor}
              disabled={guardando}
              onChange={(e) => setValor(e.target.value)}
              onBlur={(e) => guardar(e.target.value)}
            />
            <span className="os-raven-sobre">de {RAVEN_MAXIMO}</span>
          </span>
        </label>

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

        <Origen origen={origen} sesion={sesion} raw={raw} tardo={tardo} />
      </div>

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

      {error && <p className="os-form-error">{error}</p>}

      <div className="os-raven-glosario">
        {p !== null && d !== null ? (
          <>
            <p>
              <strong>Percentil {p}.</strong> De cada cien personas que rindieron el test,{' '}
              {Math.round(p)} sacaron menos puntos y {100 - Math.round(p)} sacaron más. Es una
              posición dentro del grupo. Las respuestas acertadas se cuentan aparte: son{' '}
              {valor || 0} de {RAVEN_MAXIMO}.
            </p>
            <p>
              <strong>
                Desvíos {d > 0 ? '+' : ''}
                {coma(d)}.
              </strong>{' '}
              Quedó {coma(Math.abs(d))} {d < 0 ? 'por debajo' : 'por encima'} del promedio,
              que son 18,19 aciertos. Cada desvío equivale a 6,32 aciertos. Cuando dos candidatos
              caen en el mismo rango, este número los separa.
            </p>
          </>
        ) : (
          <p>
            El <strong>percentil</strong> dice cuántas personas de cada cien sacaron menos puntos.
            Los <strong>desvíos</strong> dicen a qué distancia del promedio quedó, en unidades de
            6,32 aciertos.
          </p>
        )}
        <p className="os-benziger-aviso">
          El percentil sale del baremo del manual y arriba de 28 aciertos es una proyección. Los
          rangos cortan por puntaje directo, con la frecuencia de los candidatos de Campos HR, que
          promedian 21,11 aciertos. En Configuración se ve, al lado, la que van dando los casos
          propios a medida que se cargan.
        </p>
      </div>
    </div>
  );
}

