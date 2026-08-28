'use client';

/**
 * El análisis discursivo, en la ficha.
 *
 * La evaluadora ubica a la persona en uno de los cuatro estratos. El sistema no
 * deduce el nivel: se toma sobre unos cinco minutos de discurso y lo ubica quien
 * lo escuchó.
 *
 * **Va sin la pirámide**: dibujarla acá ocupaba media pantalla para elegir entre
 * cuatro cosas. La pirámide es del informe, que es donde el cliente la lee; acá
 * alcanza con la lista de estratos y su referencia laboral.
 *
 * Debajo van los dos datos del diagrama de progreso potencial: la edad y el
 * horizonte temporal. **El diagrama se dibuja acá mismo** y no solo en el
 * informe: es la comprobación de que el punto cayó donde la evaluadora esperaba,
 * y si no, el número está a un toque de corregirse.
 *
 * El capítulo del informe sale del catálogo de estratos, así que elegir el
 * escalón y cargar esos dos datos es todo lo que hay que hacer.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NivelDiscursivo } from '@/lib/discursivo';
import {
  UNIDADES,
  aDias,
  bandaDe,
  comoSeDice,
  desdeDias,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  type Unidad,
} from '@/lib/potencial';
import Progreso from '../../informe/_doc/Progreso';

export default function Discursivo({
  id,
  nivel,
  niveles,
  edad,
  edadEvaluacion,
  dias,
}: {
  id: string;
  nivel: string | null;
  /** Los cuatro, del más alto al más bajo, con lo que rige. */
  niveles: { nombre: string; romano: string; procesamiento: string; que: string }[];
  /** La edad guardada para el diagrama, si ya se cargó. */
  edad: number | null;
  /** La que quedó congelada el día de la entrevista, si la hay. */
  edadEvaluacion: number | null;
  /** El horizonte guardado, en días. */
  dias: number | null;
}) {
  const router = useRouter();
  const [puesto, setPuesto] = useState(nivel);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La edad arranca con la de la evaluación cuando todavía no se cargó una:
  // volver a escribir un dato que el sistema ya tiene es trabajo de más.
  const [suEdad, setSuEdad] = useState(String(edad ?? edadEvaluacion ?? ''));
  const inicial = dias ? desdeDias(dias) : null;
  const [cuanto, setCuanto] = useState(inicial ? String(inicial.cantidad) : '');
  const [unidad, setUnidad] = useState<Unidad>(inicial?.unidad ?? 'anios');

  async function mandar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/discursivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, ...cuerpo }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar(elegido: string | null) {
    const antes = puesto;
    setPuesto(elegido);
    if (!(await mandar({ nivel: elegido }))) setPuesto(antes);
  }

  /** La edad se guarda al salir del campo, vacía la borra. */
  async function guardarEdad() {
    const limpio = suEdad.trim();
    const n = limpio ? Number(limpio) : null;
    if (n !== null && !Number.isFinite(n)) return;
    await mandar({ nivel: puesto, edad: n });
  }

  /** El horizonte viaja en días: el par número + unidad es solo para escribirlo. */
  async function guardarHorizonte(cantidad: string, u: Unidad) {
    const limpio = cantidad.trim();
    const n = limpio ? Number(limpio.replace(',', '.')) : null;
    if (n === null) {
      await mandar({ nivel: puesto, horizonteDias: null });
      return;
    }
    const d = aDias(n, u);
    if (d === null) {
      setError('El horizonte tiene que ir entre un día y cincuenta años.');
      return;
    }
    await mandar({ nivel: puesto, horizonteDias: d });
  }

  const edadNum = Number(suEdad);
  const diasNum = aDias(Number(cuanto.replace(',', '.')), unidad);
  const dibuja = Number.isFinite(edadNum) && edadNum >= 16 && edadNum <= 80 && diasNum !== null;
  const banda = dibuja ? bandaDe(edadNum, diasNum as number) : null;
  const hoy = dibuja ? estratoDeEscalon(escalonDe(diasNum as number)) : null;
  const elegido = niveles.find((n) => n.nombre === puesto);

  return (
    <div className="os-discursivo">
      {/* La lista se elige, no se lee. El punto vacío de cada opción es lo que
          dice que falta decidir: un párrafo arriba explicándolo se salteaba, y
          la lista sin marcas se leía como un dato ya resuelto. */}
      <span className="os-etiqueta-campo">Elegí el estrato</span>

      <ol className="os-estratos-elegir" role="radiogroup" aria-label="Estrato">
        {niveles.map((n) => {
          const suyo = puesto === n.nombre;
          return (
            <li key={n.nombre}>
              <button
                type="button"
                role="radio"
                className={`os-estrato-opcion${suyo ? ' suyo' : ''}`}
                disabled={guardando}
                aria-checked={suyo}
                // Volver a apretar el que ya estaba lo desmarca: es la forma de
                // corregir sin tener que elegir otro que no corresponde.
                onClick={() => guardar(suyo ? null : (n.nombre as NivelDiscursivo))}
              >
                <span className="os-estrato-marca" aria-hidden="true" />
                <span className="os-estrato-texto">
                  <span className="os-estrato-titulo">
                    <strong>{n.nombre}</strong>
                    <span className="os-estrato-numeral">Estrato {n.romano}</span>
                  </span>
                  <small>{n.que}</small>
                </span>
                <span className="os-estrato-proceso">{n.procesamiento}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Los dos datos del diagrama. El horizonte es el lapso de la tarea más
          larga que la persona puede sostener sola: es la lectura de la
          evaluadora sobre lo que escuchó, no una cuenta. */}
      <div className="os-potencial-datos">
        <span className="os-etiqueta-campo">Diagrama de progreso potencial</span>
        <div className="os-potencial-campos">
          <label className="os-potencial-campo">
            <span>Edad</span>
            <input
              className="os-control-suave os-potencial-numero"
              inputMode="numeric"
              value={suEdad}
              disabled={guardando}
              onChange={(e) => setSuEdad(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onBlur={guardarEdad}
            />
          </label>

          <label className="os-potencial-campo">
            <span>Horizonte temporal</span>
            <span className="os-potencial-par">
              <input
                className="os-control-suave os-potencial-numero"
                inputMode="decimal"
                value={cuanto}
                disabled={guardando}
                placeholder="0"
                onChange={(e) => setCuanto(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))}
                onBlur={() => guardarHorizonte(cuanto, unidad)}
              />
              <select
                className="os-control-suave"
                value={unidad}
                disabled={guardando}
                onChange={(e) => {
                  const u = e.target.value as Unidad;
                  setUnidad(u);
                  guardarHorizonte(cuanto, u);
                }}
              >
                {UNIDADES.map((u) => (
                  <option key={u.clave} value={u.clave}>
                    {u.texto}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        {/* El horizonte y el estrato son dos lecturas de lo mismo, así que
            tienen que coincidir: si no, uno de los dos está mal cargado y hay
            que revisarlo antes de que salga en el informe. */}
        {dibuja && hoy && elegido && elegido.romano !== hoy.romano && (
          <p className="os-potencial-choca">
            Ese horizonte cae en el estrato {hoy.romano} y el elegido arriba es el{' '}
            {elegido.romano}. Revisá cuál de los dos corresponde.
          </p>
        )}

        {/* Lo que dice el punto, en una línea: el estrato de hoy y hasta dónde
            llega su banda. Es la comprobación de que el dato quedó bien. */}
        {dibuja && hoy && banda !== null && (
          <>
            <p className="os-potencial-lectura">
              Hoy en el estrato <strong>{hoy.romano}</strong>
              {hoy.mide ? ` · ${hoy.nombre}` : ''}. Por su banda llega a{' '}
              <strong>{comoSeDice(estratoDeEscalon(horizonteEn(banda, 50)))}</strong> a los 50 y a{' '}
              <strong>{comoSeDice(estratoDeEscalon(horizonteEn(banda, 60)))}</strong> a los 60.
            </p>
            <div className="os-potencial-grafico">
              <Progreso edad={edadNum} dias={diasNum as number} />
            </div>
          </>
        )}
      </div>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
