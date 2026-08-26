'use client';

/**
 * Todo lo que se puede cambiar de una batería, menos el precio.
 *
 * Estaba escrito en la base y se cambiaba a mano contra Supabase. Qué se toma y
 * qué se entrega se tilda de una lista y no se escribe, porque el nombre no es
 * decorativo: la entrevista se cierra sola cuando están administrados los
 * tests de la batería, y ahí se los busca por su nombre exacto. Por eso se
 * tilda de una lista y no se escribe.
 *
 * **Cada batería se guarda sola.** Son tres tarjetas y un botón por tarjeta;
 * uno solo al pie obligaría a saber cuál de las tres se tocó.
 *
 * El punto verde o rojo dice si entra, y es el mismo punto de color con el que
 * se leen las etapas y los estados en el resto del OS: el renglón entero es el
 * botón que lo cambia.
 *
 * **Vale para adelante.** Una evaluación ya tomada conserva lo que se le tomó,
 * que son sus marcas de administrado; lo que cambia es lo que se le va a pedir
 * a la próxima.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ENTREGABLES, TESTS } from '@/lib/baterias-contenido';

/**
 * Entra o no entra, con el punto de color del resto del OS.
 *
 * Es un `switch` y no una casilla: lo que se dice es que el test está adentro o
 * afuera, y el rojo lo dice de lejos. El renglón entero es el botón, así que
 * también sirve el nombre para apretar.
 */
function Punto({
  puesto,
  que,
  alternar,
  children,
}: {
  puesto: boolean;
  /** Qué se prende o se apaga, para quien no ve el color. */
  que: string;
  alternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`os-entra${puesto ? ' puesto' : ''}`}
      role="switch"
      aria-checked={puesto}
      aria-label={`${que}: ${puesto ? 'entra' : 'no entra'}`}
      onClick={alternar}
    >
      <span className={`os-punto-etapa ${puesto ? 'os-verde' : 'os-rojo'}`} />
      <span>{children}</span>
    </button>
  );
}

export type Editable = {
  nombre: string;
  descripcion: string;
  paraQuien: string;
  /** En minutos, que es como se carga y como se compara. */
  duracion: number | null;
  tests: string[];
  outputs: string[];
};

/** Cuánto dura, escrito como se dice. */
function duracion(min: number | null): string {
  if (!min) return 'sin cargar';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function Bateria({
  bateriaId,
  puesta,
  benziger,
}: {
  bateriaId: string;
  /** Lo que está guardado hoy. */
  puesta: Editable;
  /** El renglón del Benziger, que no es de la batería sino del pedido. */
  benziger: string;
}) {
  const router = useRouter();
  const [puestos, setPuestos] = useState(puesta);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firma = JSON.stringify(puesta);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setPuestos(puesta);
  }

  const cambiado = JSON.stringify(puestos) !== firma;
  const sinMarca = !puestos.tests.some((t) => TESTS.find((x) => x.nombre === t)?.marca);

  function alternar(campo: 'tests' | 'outputs', nombre: string) {
    setPuestos((p) => ({
      ...p,
      [campo]: p[campo].includes(nombre)
        ? p[campo].filter((x) => x !== nombre)
        : [...p[campo], nombre],
    }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/baterias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bateriaId, ...puestos }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  function escribir(campo: 'nombre' | 'descripcion' | 'paraQuien', valor: string) {
    setPuestos((p) => ({ ...p, [campo]: valor }));
  }

  return (
    <>
      <div className="os-bateria-dato os-redaccion">
        <label className="os-etiqueta-campo" htmlFor={`nombre-${bateriaId}`}>
          Nombre
        </label>
        <input
          id={`nombre-${bateriaId}`}
          className="os-campo"
          value={puestos.nombre}
          onChange={(e) => escribir('nombre', e.target.value)}
        />

        <label className="os-etiqueta-campo" htmlFor={`incluye-${bateriaId}`}>
          Qué incluye
        </label>
        {/* Alto fijo y no atado al contenido: con tres baterías una al lado de
            la otra, un renglón de más en la del medio corría hacia abajo todo
            lo que sigue y las tres columnas dejaban de compararse. */}
        <textarea
          id={`incluye-${bateriaId}`}
          className="os-campo os-campo-bateria"
          rows={3}
          value={puestos.descripcion}
          onChange={(e) => escribir('descripcion', e.target.value)}
        />

        <label className="os-etiqueta-campo" htmlFor={`quien-${bateriaId}`}>
          Para quién se recomienda
        </label>
        <textarea
          id={`quien-${bateriaId}`}
          className="os-campo os-campo-bateria"
          rows={2}
          value={puestos.paraQuien}
          onChange={(e) => escribir('paraQuien', e.target.value)}
        />

        <label className="os-etiqueta-campo" htmlFor={`dura-${bateriaId}`}>
          Duración
        </label>
        <span className="os-bateria-duracion">
          <input
            id={`dura-${bateriaId}`}
            className="os-campo os-campo-corte"
            type="number"
            min={0}
            max={600}
            value={puestos.duracion ?? ''}
            onChange={(e) =>
              setPuestos((p) => ({
                ...p,
                duracion: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
          <span className="os-dato-flojo">minutos · {duracion(puestos.duracion)}</span>
        </span>
      </div>

      <div className="os-bateria-dato">
        <span className="os-bateria-titulo">Se le toma</span>
        <ul className="os-tildes">
          {TESTS.map((t) => (
            <li key={t.nombre}>
              <Punto
                puesto={puestos.tests.includes(t.nombre)}
                que={`${t.nombre} en esta batería`}
                alternar={() => alternar('tests', t.nombre)}
              >
                {t.nombre}
                {!t.marca && <span className="os-dato-flojo"> · sin marca</span>}
              </Punto>
            </li>
          ))}
          <li className="os-lista-opcional">{benziger}</li>
        </ul>
      </div>

      <div className="os-bateria-dato">
        <span className="os-bateria-titulo">Se le entrega al cliente</span>
        <ul className="os-tildes">
          {ENTREGABLES.map((e) => (
            <li key={e.nombre}>
              <Punto
                puesto={puestos.outputs.includes(e.nombre)}
                que={`${e.nombre} en esta batería`}
                alternar={() => alternar('outputs', e.nombre)}
              >
                {e.nombre}
              </Punto>
            </li>
          ))}
        </ul>
      </div>

      {sinMarca && (
        <p className="os-form-nota">
          Sin ningún test que deje marca, la entrevista no se cierra sola: hay que apretar
          &quot;Entrevista tomada&quot;.
        </p>
      )}

      {cambiado && (
        <div className="os-barra-acciones">
          <button className="os-boton os-boton-firme" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="os-boton" disabled={guardando} onClick={() => setPuestos(puesta)}>
            Deshacer
          </button>
        </div>
      )}
      {error && <p className="os-form-error">{error}</p>}
    </>
  );
}
