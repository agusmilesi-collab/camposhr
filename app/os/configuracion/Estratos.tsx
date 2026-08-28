'use client';

/**
 * Los cuatro estratos del potencial, editables.
 *
 * Van de arriba abajo como en la pirámide del informe, que es como los mira
 * quien tiene que ubicar a una persona: se lee del estrato más alto hacia el
 * más bajo hasta encontrar el que describe lo que se escuchó.
 *
 * **Un estrato no es un cargo.** El mismo nivel de complejidad puede aparecer
 * en un rol gerencial, en uno de especialista o en un contribuidor individual,
 * y la cantidad de gente a cargo no lo determina.
 *
 * **Se guarda la diferencia y no los cuatro**: lo que quedó igual al código no
 * se guarda, así que una corrección que mañana entre por ahí llega a quien no
 * tocó nada.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  LARGO_MAXIMO,
  NOTA_ADAPTACION,
  NOTA_EJEMPLOS,
  type TextoDeNivel,
} from '@/lib/discursivo';
import { ESCALERA, ESTRATOS } from '@/lib/potencial';

export type Estrato = TextoDeNivel & {
  nombre: string;
  estrato: number;
  romano: string;
  procesamiento: string;
  original: TextoDeNivel;
};

/**
 * El corte que usa el sistema para ese estrato, en palabras.
 *
 * El texto del horizonte lo escribe quien configura, y el cálculo del diagrama
 * y de la tabla usa los cortes del modelo, que están en `lib/potencial`. Son
 * dos cosas distintas que tienen que decir lo mismo: mostrando el corte al lado
 * del campo, una edición no puede desalinearlos sin que se vea.
 */
function corteDe(estrato: number): string {
  const e = ESTRATOS[estrato - 1];
  if (!e) return '';
  const marcas: readonly { texto: string }[] = ESCALERA;
  const hasta = marcas[e.hasta]?.texto ?? '';
  // El estrato I arranca por debajo de la escalera: su piso no tiene marca.
  const desde = e.desde >= 0 ? marcas[e.desde]?.texto : null;
  return desde ? `de ${desde} a ${hasta}` : `hasta ${hasta}`;
}

const CAMPOS = [
  { clave: 'que', rotulo: 'Referencia laboral', filas: 2, ayuda: 'Va al lado del escalón en la pirámide' },
  { clave: 'horizonte', rotulo: 'Horizonte temporal', filas: 2, ayuda: '' },
  { clave: 'actual', rotulo: 'Capacidad potencial actual', filas: 8, ayuda: '' },
  {
    clave: 'ejemplos',
    rotulo: 'Dónde suele verse',
    filas: 6,
    ayuda: 'Uno por renglón. Salen como lista en el informe',
  },
  { clave: 'proyeccion', rotulo: 'Capacidad potencial futura', filas: 6, ayuda: '' },
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
          {
            que: n.que,
            horizonte: n.horizonte,
            actual: n.actual,
            ejemplos: n.ejemplos,
            proyeccion: n.proyeccion,
          },
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
        if (escrito !== n.original[c.clave]) uno[c.clave] = escrito;
      }
      if (Object.keys(uno).length > 0) d[n.nombre] = uno;
    }
    return d;
  }

  return (
    <>
      <div className="os-redacciones">
        {niveles.map((n) => (
          <section className="os-panel os-indice-panel" key={n.nombre}>
            <div className="os-panel-top">
              <h3 className="os-indice-nombre-titulo">
                <span className="os-numero">Estrato {n.romano}.</span> {n.nombre}
              </h3>
              <span className="os-columna-monto">
                Procesamiento {n.procesamiento.toLowerCase()}
              </span>
              {CAMPOS.some((c) => textos[n.nombre][c.clave].trim() !== n.original[c.clave]) && (
                <span className="os-dato-falta">reescrito</span>
              )}
            </div>

            <div className="os-rama">
              <div className="os-redaccion os-redaccion-estratos">
                {CAMPOS.map((c) => (
                  <div className="os-redaccion-campo" key={c.clave}>
                    <label className="os-etiqueta-campo" htmlFor={`${c.clave}-${n.estrato}`}>
                      {c.rotulo}
                      {c.ayuda && <span className="os-etiqueta-ayuda">{c.ayuda}</span>}
                      {/* El corte con el que el sistema mide, al lado del texto
                          que lo describe: son dos cosas distintas y tienen que
                          decir lo mismo. El texto se escribe acá; el corte sale
                          del modelo y no se toca. */}
                      {c.clave === 'horizonte' && (
                        <span className="os-etiqueta-ayuda">
                          El sistema mide {corteDe(n.estrato)}
                        </span>
                      )}
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
            La referencia laboral sale al lado de cada escalón de la pirámide, y por eso no
            puede quedar vacía: sin eso el escalón queda mudo. El resto arma el capítulo de
            potencial del informe de quien caiga en ese estrato.
          </p>
          <p className="os-form-nota">{NOTA_ADAPTACION}</p>
          <p className="os-form-nota">{NOTA_EJEMPLOS}</p>

          {tocado && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null)}
                title="Borra lo que se escribió y deja los textos originales"
              >
                Volver a los originales
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
