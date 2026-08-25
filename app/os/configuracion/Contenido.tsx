'use client';

/**
 * Qué se toma y qué se entrega en una batería, con tildes.
 *
 * Estaba escrito en la base y se cambiaba a mano contra Supabase. El nombre no
 * es decorativo: la entrevista se cierra sola cuando están administrados los
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

export default function Contenido({
  bateriaId,
  tests,
  outputs,
  benziger,
}: {
  bateriaId: string;
  tests: string[];
  outputs: string[];
  /** El renglón del Benziger, que no es de la batería sino del pedido. */
  benziger: string;
}) {
  const router = useRouter();
  const [puestos, setPuestos] = useState({ tests, outputs });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firma = JSON.stringify({ tests, outputs });
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setPuestos({ tests, outputs });
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
        body: JSON.stringify({ bateriaId, tests: puestos.tests, outputs: puestos.outputs }),
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

  return (
    <>
      <div className="os-bateria-dato">
        <span className="os-dato-rotulo">Se le toma</span>
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
        <span className="os-dato-rotulo">Se le entrega al cliente</span>
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
          <button
            className="os-boton"
            disabled={guardando}
            onClick={() => setPuestos({ tests, outputs })}
          >
            Deshacer
          </button>
        </div>
      )}
      {error && <p className="os-form-error">{error}</p>}
    </>
  );
}
