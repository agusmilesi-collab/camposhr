'use client';

/**
 * Los textos de los cuatro cuadrantes del Benziger.
 *
 * Son ocho campos por cuadrante y treinta y dos en total, así que se edita uno
 * por vez, en pestañas. Lo escrito en otra pestaña no se pierde al cambiar, y
 * la barra de guardar cuenta los cuatro.
 *
 * **Un campo por renglón, a todo el ancho.** Es texto corrido que se lee entero,
 * no un dato corto que entre al lado de otro.
 *
 * **La fuente va al lado de cada campo.** Nada de esto es redacción propia, y
 * quien lo corrija tiene que ver de qué página salió antes de cambiarlo.
 *
 * **Un campo del manual para el líder se puede vaciar**, y entonces ese renglón
 * no sale en el informe. "Cómo es" no: sin él, el capítulo nombra el cuadrante
 * y no dice nada de la persona.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Opciones from '@/app/os/Opciones';
import {
  CAMPOS_BENZIGER,
  LARGO_MAXIMO_BENZIGER,
  type CampoBenziger,
  type TextosDeCuadrante,
} from '@/lib/benziger-textos';
import type { Perfil } from '@/lib/perfiles';

export type CuadranteEditable = {
  clave: Perfil;
  nombre: string;
  textos: TextosDeCuadrante;
  original: TextosDeCuadrante;
  fuentes: Record<CampoBenziger, string>;
};

export default function Cuadrantes({
  cuadrantes,
  tocado,
}: {
  cuadrantes: CuadranteEditable[];
  tocado: boolean;
}) {
  const router = useRouter();

  const puestos = useMemo(
    () => Object.fromEntries(cuadrantes.map((c) => [c.clave, c.textos])) as Record<Perfil, TextosDeCuadrante>,
    [cuadrantes]
  );

  const [textos, setTextos] = useState(puestos);
  const [ver, setVer] = useState<Perfil>(cuadrantes[0].clave);
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

  const distinto = (c: CuadranteEditable) =>
    CAMPOS_BENZIGER.some((k) => textos[c.clave][k.clave] !== puestos[c.clave][k.clave]);
  const sinGuardar = cuadrantes.filter(distinto);
  const cambiado = sinGuardar.length > 0;
  const sinComoEs = cuadrantes.filter((c) => !textos[c.clave].comoEs.trim());

  const reescrito = (c: CuadranteEditable, k: CampoBenziger) =>
    textos[c.clave][k].trim() !== c.original[k];

  async function guardar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'benziger_cuadrantes', valor }),
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

  /** Solo lo que quedó distinto del original. */
  function diferencias(): Record<string, Partial<TextosDeCuadrante>> {
    const d: Record<string, Partial<TextosDeCuadrante>> = {};
    for (const c of cuadrantes) {
      const uno: Partial<TextosDeCuadrante> = {};
      for (const k of CAMPOS_BENZIGER) {
        const escrito = textos[c.clave][k.clave].trim();
        if (escrito !== c.original[k.clave]) uno[k.clave] = escrito;
      }
      if (Object.keys(uno).length > 0) d[c.clave] = uno;
    }
    return d;
  }

  /** El ancla de cada parte, para que el índice pueda bajar a ella. */
  const ancla = (c: Perfil, parte: 'es' | 'conducir' | 'top') => `bzg-${c}-${parte}`;

  const campo = (c: CuadranteEditable, k: (typeof CAMPOS_BENZIGER)[number]) => (
    <div className="os-bzg-campo" key={k.clave}>
      <div className="os-bzg-rotulo">
        <label className="os-bzg-titulo" htmlFor={`bzg-${c.clave}-${k.clave}`}>
          {k.rotulo}
        </label>
        {reescrito(c, k.clave) && (
          <>
            <span className="os-dato-falta">reescrito</span>
            <button
              type="button"
              className="os-enlace-boton"
              onClick={() =>
                setTextos((t) => ({
                  ...t,
                  [c.clave]: { ...t[c.clave], [k.clave]: c.original[k.clave] },
                }))
              }
            >
              Volver al original
            </button>
          </>
        )}
      </div>
      <span className="os-bzg-fuente">{c.fuentes[k.clave]}</span>
      <textarea
        id={`bzg-${c.clave}-${k.clave}`}
        className="os-campo"
        rows={k.filas}
        maxLength={LARGO_MAXIMO_BENZIGER}
        value={textos[c.clave][k.clave]}
        onChange={(e) =>
          setTextos((t) => ({
            ...t,
            [c.clave]: { ...t[c.clave], [k.clave]: e.target.value },
          }))
        }
      />
    </div>
  );

  return (
    <>
      <Opciones
        valor={ver}
        etiqueta="Qué cuadrante se edita"
        opciones={cuadrantes.map((c) => ({
          v: c.clave,
          texto: distinto(c) ? `${c.nombre} · sin guardar` : c.nombre,
        }))}
        alElegir={setVer}
      />

      <div className="os-redacciones">
        {cuadrantes
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.clave === ver)
          .map(({ c, i }) => (
          <div key={c.clave}>
            <div className="os-area" id={ancla(c.clave, 'top')}>
              <h2 className="os-area-titulo">
                <span className="os-numero">{i + 1}.</span> {c.nombre}
              </h2>
              {CAMPOS_BENZIGER.some((k) => reescrito(c, k.clave)) && (
                <span className="os-area-cuenta">con textos reescritos</span>
              )}
            </div>

            {/* Las dos partes van a capítulos distintos del informe, y cada
                panel dice a cuál, para que no haya que recordarlo. */}
            <section className="os-panel os-indice-panel os-bzg" id={ancla(c.clave, 'es')}>
              <div className="os-panel-top">
                <h3 className="os-indice-nombre-titulo">Cómo es</h3>
                <span className="os-indice-ramas">Capítulo de estilos de pensamiento</span>
              </div>
              <div className="os-panel-cuerpo">{campo(c, CAMPOS_BENZIGER[0])}</div>
            </section>

            <section className="os-panel os-indice-panel os-bzg" id={ancla(c.clave, 'conducir')}>
              <div className="os-panel-top">
                <h3 className="os-indice-nombre-titulo">Cómo conducir a esta persona</h3>
                <span className="os-indice-ramas">
                  Plan de incorporación, para su líder. Un campo vacío no sale en el informe
                </span>
              </div>
              <div className="os-panel-cuerpo">
                {CAMPOS_BENZIGER.slice(1).map((k) => campo(c, k))}
              </div>
            </section>
          </div>
        ))}
      </div>

      <section className="os-panel">
        <div className="os-panel-cuerpo">

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
            ) : sinComoEs.length > 0 ? (
              <span className="os-form-error">{sinComoEs[0].nombre} se quedó sin "Cómo es"</span>
            ) : (
              `${sinGuardar.length} ${sinGuardar.length === 1 ? 'cuadrante cambiado' : 'cuadrantes cambiados'}`
            )}
          </span>
          <button className="os-boton" disabled={guardando} onClick={() => setTextos(puestos)}>
            Deshacer
          </button>
          <button
            className="os-boton os-boton-azul"
            disabled={guardando || sinComoEs.length > 0}
            onClick={() => guardar(diferencias())}
          >
            {guardando ? 'Guardando…' : 'Guardar los textos'}
          </button>
        </div>
      )}
    </>
  );
}
