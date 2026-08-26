'use client';

/**
 * Los cuatro estratos del potencial, editables.
 *
 * Van de arriba abajo como en la pirámide del informe, que es como los mira
 * quien tiene que ubicar a una persona: se lee de la gerencia general hacia la
 * primera línea de trabajo hasta encontrar el escalón que describe lo que se
 * escuchó.
 *
 * **Se guarda la diferencia y no los cuatro**: lo que quedó igual al código no
 * se guarda, así que una corrección que mañana entre por ahí llega a quien no
 * tocó nada.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LARGO_MAXIMO, type TextoDeNivel } from '@/lib/discursivo';

export type Estrato = {
  nombre: string;
  estrato: number;
  que: string;
  lapso: string;
  caracteristicas: string;
  fabrica: TextoDeNivel;
};

const CAMPOS = [
  { clave: 'que', rotulo: 'Qué rol abarca', filas: 2 },
  { clave: 'lapso', rotulo: 'Lapso del rol', filas: 1 },
  { clave: 'caracteristicas', rotulo: 'Características principales', filas: 8 },
] as const;

export default function Estratos({
  niveles,
  tocado,
}: {
  niveles: Estrato[];
  tocado: boolean;
}) {
  const router = useRouter();

  const puestos = useMemo(
    () =>
      Object.fromEntries(
        niveles.map((n) => [
          n.nombre,
          { que: n.que, lapso: n.lapso, caracteristicas: n.caracteristicas },
        ])
      ) as Record<string, TextoDeNivel>,
    [niveles]
  );

  const [textos, setTextos] = useState<Record<string, TextoDeNivel>>(puestos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente. Se compara por valor porque cada dibujo manda un
  // objeto nuevo.
  const firma = JSON.stringify(puestos);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setTextos(puestos);
  }

  const sinGuardar = niveles.filter((n) =>
    CAMPOS.some((c) => textos[n.nombre][c.clave] !== puestos[n.nombre][c.clave])
  );
  const cambiado = sinGuardar.length > 0;
  const vacios = niveles.filter((n) => !textos[n.nombre].que.trim());

  async function guardar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'discursivo_niveles', valor }),
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

  /** Solo lo que quedó distinto de lo que trae el código. */
  function diferencias(): Record<string, Partial<TextoDeNivel>> {
    const d: Record<string, Partial<TextoDeNivel>> = {};
    for (const n of niveles) {
      const uno: Partial<TextoDeNivel> = {};
      for (const c of CAMPOS) {
        const escrito = textos[n.nombre][c.clave].trim();
        if (escrito !== n.fabrica[c.clave]) uno[c.clave] = escrito;
      }
      if (Object.keys(uno).length > 0) d[n.nombre] = uno;
    }
    return d;
  }

  return (
    <>
      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            Los cuatro escalones del modelo de Jaques, que ordena los roles por el lapso de
            tiempo que abarca la tarea más larga que el puesto exige: cuanto más lejos tiene que
            proyectar quien lo ocupa, más alto el estrato. El sistema no lo calcula. La
            evaluadora escucha unos cinco minutos de discurso del candidato y elige el escalón,
            y estos textos son los que sostienen esa decisión.
          </p>
        </div>
      </section>

      <div className="os-redacciones">
        {niveles.map((n) => (
          <section className="os-panel os-indice-panel" key={n.nombre}>
            <div className="os-panel-top">
              <h3 className="os-indice-nombre-titulo">
                <span className="os-numero">Estrato {n.estrato}.</span> {n.nombre}
              </h3>
              {CAMPOS.some((c) => textos[n.nombre][c.clave].trim() !== n.fabrica[c.clave]) && (
                <span className="os-dato-falta">reescrito</span>
              )}
            </div>

            <div className="os-rama">
              <div className="os-redaccion os-redaccion-estratos">
                {CAMPOS.map((c) => (
                  <div className="os-redaccion-campo" key={c.clave}>
                    <label className="os-etiqueta-campo" htmlFor={`${c.clave}-${n.estrato}`}>
                      {c.rotulo}
                    </label>
                    <textarea
                      id={`${c.clave}-${n.estrato}`}
                      className="os-campo os-campo-estrato"
                      rows={c.filas}
                      maxLength={LARGO_MAXIMO}
                      value={textos[n.nombre][c.clave]}
                      onChange={(e) =>
                        setTextos((t) => ({
                          ...t,
                          [n.nombre]: { ...t[n.nombre], [c.clave]: e.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            El rol y el lapso son los que se leen al elegir el escalón y los que salen impresos
            en la pirámide del informe. Las características quedan de referencia para quien
            evalúa. Un estrato sin rol se rechaza: la pirámide lo dibujaría mudo.
          </p>

          {tocado && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null)}
                title="Borra lo guardado y vuelve a los textos del código"
              >
                Volver a los de fábrica
              </button>
            </div>
          )}
          {error && !cambiado && <p className="os-form-error">{error}</p>}
        </div>
      </section>

      {cambiado && (
        <div className="os-guardar-barra">
          <span className="os-guardar-cuenta">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : vacios.length > 0 ? (
              <span className="os-form-error">
                {vacios.length === 1
                  ? `${vacios[0].nombre} se quedó sin rol`
                  : `${vacios.length} estratos sin rol`}
              </span>
            ) : (
              `${sinGuardar.length} ${
                sinGuardar.length === 1 ? 'estrato cambiado' : 'estratos cambiados'
              }`
            )}
          </span>
          <button className="os-boton" disabled={guardando} onClick={() => setTextos(puestos)}>
            Deshacer
          </button>
          <button
            className="os-boton os-boton-azul"
            disabled={guardando || vacios.length > 0}
            onClick={() => guardar(diferencias())}
          >
            {guardando ? 'Guardando…' : 'Guardar los textos'}
          </button>
        </div>
      )}
    </>
  );
}
