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
import { armarPlaybook, opuesto } from '@/lib/playbook';
import { marcadasDe } from '@/lib/facetas';
import { PLACAS } from '@/lib/cuestionario';
import { apellidoNombre, nombreCompleto } from '@/lib/personas';
import Playbook, { type Informe } from './Playbook';

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
  /** Respuestas crudas: de acá salen las frases que marcó. */
  detalle?: unknown;
};

/**
 * El informe de una persona. Lo usan el equipo de Campos HR desde tools y el
 * líder desde su propio enlace: es la misma vista.
 */
export default function VistaPlaybook({ persona }: { persona: Persona }) {
  const totales = persona.totales as unknown as Puntajes;
  const perfil = (persona.perfiles?.[0] ?? 'BD') as Perfil;
  const contrario = opuesto(perfil);
  const generacion = generacionDe(persona.generacion);
  const marcadas = marcadasDe(persona.detalle);
  const playbook = armarPlaybook(perfil, generacion, marcadas, totales);

  const frasesDe = (p: Perfil): string[] => {
    const placa = PLACAS.find((x) => x.tipo === 'frases' && x.perfil === p);
    if (!placa || placa.tipo !== 'frases') return [];
    return (marcadas[p] ?? []).map((i) => placa.frases[i]).filter(Boolean);
  };

  const informe: Informe = {
    lectura: esParejo(totales)
      ? `Ningún cuadrante supera los ${UMBRAL} puntos: usa los cuatro en un nivel parecido y se adapta a contextos distintos, pero ninguna forma de trabajo le resulta francamente natural. El más alto es ${INFO[perfil].nombre}, y es la inclinación que guía este informe. Tomalo como hipótesis a contrastar con lo que ves en el día a día.`
      : 'Tiene un cuadrante preferido claro. Lo que sigue describe cómo trabaja cuando puede elegir, y qué le demanda esfuerzo cuando no.',
    preferido: {
      nombre: INFO[perfil].nombre,
      puntaje: totales[perfil],
      descripcion: INFO[perfil].descripcion,
      nivel: NIVELES[nivel(totales[perfil])].texto,
    },
    opuesto: {
      nombre: INFO[contrario].nombre,
      puntaje: totales[contrario],
      descripcion: INFO[contrario].descripcion,
      nivel: NIVELES[nivel(totales[contrario])].texto,
    },
    marcadas: [...PERFILES]
      .sort((a, b) => totales[b] - totales[a])
      .map((p) => ({
        cuadrante: INFO[p].nombre,
        puntaje: totales[p],
        frases: frasesDe(p),
      })),
  };

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

      <Playbook
        informe={informe}
        dimensiones={playbook.dimensiones}
        semanas={playbook.semanas}
        faltantes={playbook.faltantes.length}
      />
    </>
  );
}
