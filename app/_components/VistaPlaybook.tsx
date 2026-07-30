import {
  esParejo,
  INFO,
  MAXIMO,
  nivel,
  NIVELES,
  PERFILES,
  UMBRAL,
  type Perfil,
  type Puntajes,
} from '@/lib/perfiles';
import { GENERACIONES, INFO_GENERACION, type Generacion } from '@/lib/generaciones';
import { armarPlaybook, opuesto, ranking } from '@/lib/playbook';
import { marcadasDe } from '@/lib/facetas';
import { PLACAS } from '@/lib/cuestionario';
import { apellidoNombre, nombreCompleto } from '@/lib/personas';
import Playbook from './Playbook';

/** De la etiqueta guardada ("X", "Boomer/Y") al código de la primera generación. */
export function generacionDe(etiqueta: string | null): Generacion | null {
  const corto = (etiqueta ?? '').split('/')[0];
  return GENERACIONES.find((g) => INFO_GENERACION[g].corto === corto) ?? null;
}

export type Persona = {
  apellido?: string | null;
  nombre: string;
  lider_nombre: string | null;
  totales: Record<string, number>;
  perfiles: string[];
  generacion: string | null;
  /** Respuestas crudas: de acá salen las frases que marcó (capa 3). */
  detalle?: unknown;
};

/**
 * El playbook de una persona. Lo usan el equipo de Campos HR desde tools y el
 * líder desde su propio enlace: es la misma vista.
 */
export default function VistaPlaybook({ persona }: { persona: Persona }) {
  const totales = persona.totales as unknown as Puntajes;
  const perfil = (persona.perfiles?.[0] ?? 'BD') as Perfil;
  const generacion = generacionDe(persona.generacion);
  const marcadas = marcadasDe(persona.detalle);
  const playbook = armarPlaybook(perfil, generacion, marcadas, totales);
  const parejo = esParejo(totales);
  const nivelDominante = nivel(totales[perfil]);

  return (
    <>
      <section className="pb-cabecera">
        <div>
          <h1>{nombreCompleto(persona)}</h1>
          {persona.lider_nombre && (
            <p className="pb-lider">Líder: {apellidoNombre(persona.lider_nombre)}</p>
          )}
        </div>
        <div className="pb-chips">
          <span className="pb-chip pb-chip-fuerte">
            {INFO[perfil].nombre} · {totales[perfil]}
          </span>
          {generacion && (
            <span className="pb-chip">{INFO_GENERACION[generacion].nombre}</span>
          )}
        </div>
      </section>

      <section className="pb-puntajes">
        {PERFILES.map((p) => (
          <div className={p === perfil ? 'pb-puntaje pb-puntaje-on' : 'pb-puntaje'} key={p}>
            <span className="pb-puntaje-n">{totales[p]}</span>
            <span className="pb-puntaje-l">{INFO[p].nombre}</span>
            <span className="pb-barra">
              <span style={{ width: `${(totales[p] / MAXIMO) * 100}%` }} />
            </span>
            <span className="pb-nivel">{NIVELES[nivel(totales[p])].titulo}</span>
          </div>
        ))}
      </section>

      <div className="pb-lectura">
        {parejo ? (
          <p>
            <b>Perfil parejo.</b> Ningún cuadrante supera los {UMBRAL} puntos: usa
            los cuatro en un nivel similar y se adapta a contextos distintos, pero
            ninguna forma de trabajo le resulta francamente natural. El más alto es{' '}
            <b>{INFO[perfil].nombre}</b> ({totales[perfil]}), y es la inclinación que
            guía este playbook. Tomá lo que sigue como hipótesis a contrastar con lo
            que ves en el día a día, no como un rasgo marcado.
          </p>
        ) : (
          <p>
            Su cuadrante preferido es <b>{INFO[perfil].nombre}</b> ({totales[perfil]}):{' '}
            {NIVELES[nivelDominante].texto.charAt(0).toLowerCase() +
              NIVELES[nivelDominante].texto.slice(1)}
          </p>
        )}
        <p>
          El opuesto en diagonal, <b>{INFO[opuesto(perfil)].nombre}</b>{' '}
          ({totales[opuesto(perfil)]}), es el que más energía le consume: las tareas
          de ese tipo le cuestan el doble aunque pueda hacerlas.
        </p>
      </div>

      <Playbook
        dimensiones={playbook.dimensiones}
        semanas={playbook.semanas}
        faltantes={playbook.faltantes.length}
      />

      {/* Dato crudo: lo que la persona marcó, sin interpretación nuestra. */}
      <section className="pb-dijo">
        <h2>En sus palabras</h2>
        <p className="pb-dijo-bajada">
          Las frases que marcó como descriptivas de sí en el cuestionario.
        </p>
        <div className="pb-dijo-cols">
          {PERFILES.map((p) => {
            const placa = PLACAS.find((x) => x.tipo === 'frases' && x.perfil === p);
            const elegidas = marcadas[p] ?? [];
            if (!placa || placa.tipo !== 'frases' || elegidas.length === 0) return null;
            return (
              <div className="pb-dijo-col" key={p}>
                <h3>
                  {INFO[p].nombre} <em>{totales[p]}</em>
                </h3>
                <ul>
                  {elegidas.map((i) => (
                    <li key={i}>{placa.frases[i]}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pb-orden no-print">
        <h2>Orden de sus cuadrantes</h2>
        <ol>
          {ranking(totales).map((r) => (
            <li key={r.perfil}>
              {INFO[r.perfil].nombre} <em>{r.total}</em>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
