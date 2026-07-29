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
import { nombreCompleto } from '@/lib/personas';
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
};

/**
 * El playbook de una persona. Lo usan el equipo de Campos HR desde tools y el
 * líder desde su propio enlace: es la misma vista.
 */
export default function VistaPlaybook({ persona }: { persona: Persona }) {
  const totales = persona.totales as unknown as Puntajes;
  const perfil = (persona.perfiles?.[0] ?? 'BD') as Perfil;
  const generacion = generacionDe(persona.generacion);
  const playbook = armarPlaybook(perfil, generacion);
  const parejo = esParejo(totales);
  const nivelDominante = nivel(totales[perfil]);

  return (
    <>
      <section className="pb-cabecera">
        <div>
          <h1>{nombreCompleto(persona)}</h1>
          {persona.lider_nombre && (
            <p className="pb-lider">Líder: {persona.lider_nombre}</p>
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
