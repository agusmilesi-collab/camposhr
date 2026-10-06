import type { CSSProperties } from 'react';
import { IconoNivel } from '../_doc/piezas';
import type { Informe } from '@/lib/informe';
import {
  ESTRATOS,
  bandaDe as bandaDelPotencial,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  plazoDe,
} from '@/lib/potencial';

/**
 * Hasta dónde puede llegar, sin pirámide y sin números romanos.
 *
 * La pirámide del informe impreso dice bien lo que dice, y para leerla hay que
 * saber qué es un estrato. Quien recibe este informe está decidiendo una
 * contratación y necesita contestar dos preguntas: qué clase de trabajo puede
 * manejar hoy esta persona, y si eso alcanza para el puesto.
 *
 * Por eso son escalones y no una figura: cada uno dice qué clase de trabajo es,
 * con qué plazo se maneja y un ejemplo de a qué se parece. Y arriba de los
 * escalones que importan van tres marcas: lo que el puesto pide, dónde está la
 * persona hoy y hasta dónde llega con los años.
 *
 * Los nombres del modelo (estrato, procesamiento serial, horizonte temporal)
 * quedan en la parte de indicadores, que es donde se los va a buscar.
 */

/** Cómo se llama cada nivel para quien no conoce el modelo. */
const COMO_SE_LLAMA: Record<string, { nombre: string; ejemplo: string; decide: string }> = {
  I: {
    nombre: 'Ejecución de tareas',
    ejemplo: 'Un operario, un administrativo, un vendedor de mostrador.',
    decide: 'Decide cómo resolver los obstáculos de una tarea asignada',
  },
  II: {
    nombre: 'Supervisión de un equipo',
    ejemplo: 'Un supervisor, un analista, un jefe de turno.',
    decide: 'Decide después de reunir información y diagnosticar la situación',
  },
  III: {
    nombre: 'Jefatura de un área',
    ejemplo: 'Un jefe de área, un jefe de planta, un responsable comercial.',
    decide: 'Decide entre planes alternativos y deja previsto uno de reemplazo',
  },
  IV: {
    nombre: 'Gerencia de varias áreas',
    ejemplo: 'Una gerencia con varias áreas a cargo.',
    decide: 'Decide sobre varios proyectos en paralelo y ajusta cada uno según el avance de los otros',
  },
  V: {
    nombre: 'Dirección general',
    ejemplo: 'Una dirección general o la conducción de una unidad de negocio.',
    decide: 'Decide evaluando el efecto de cada cambio sobre el conjunto del negocio',
  },
};

/** Los cuatro resultados de comparar a la persona con el puesto, de mejor a peor. */
const RESULTADOS = [
  { color: 'verde', etiqueta: 'A la altura del puesto' },
  { color: 'azul', etiqueta: 'Por encima del puesto' },
  { color: 'ambar', etiqueta: 'Un nivel por debajo' },
  { color: 'rojo', etiqueta: 'Dos o más niveles por debajo' },
] as const;

/** El ícono de cada resultado: los mismos cuatro del nivel de ajuste. */
const ICONO = { verde: 'alto', azul: 'desarrollar', ambar: 'alertas', rojo: 'bajo' } as const;

/** Los cinco que se usan: del sexto para arriba son corporaciones. */
const NIVELES = ESTRATOS.slice(0, 5);

export default function Escalera({ inf }: { inf: Informe }) {
  const d = inf.discursivo;
  if (!d) return null;

  const hoy = d.detalle?.romano ?? null;
  const delPuesto = d.puesto?.romano ?? null;

  /* Hasta dónde llega con los años: la banda de maduración que lo contiene,
     leída a los 50, que es donde la curva ya se aplanó. */
  const futuro = d.punto
    ? estratoDeEscalon(horizonteEn(bandaDelPotencial(d.punto.edad, d.punto.dias), 50)).romano
    : null;

  const numero = (r: string | null) => (r ? NIVELES.findIndex((e) => e.romano === r) + 1 : 0);
  const alcanza = hoy && delPuesto ? numero(hoy) - numero(delPuesto) : null;

  /* A qué edad alcanzaría el nivel que pide el puesto, si hoy le falta.
     Se recorre su banda de maduración año por año hasta el primero en que el
     medio de la banda cae en el nivel del puesto. La escalera llega hasta los
     65: más allá, la edad no le sirve a quien está contratando. */
  const EDAD_TOPE = 65;
  let edadDelPuesto: number | null = null;
  if (d.punto && alcanza !== null && alcanza < 0) {
    const banda = bandaDelPotencial(d.punto.edad, d.punto.dias);
    for (let edad = Math.floor(d.punto.edad) + 1; edad <= EDAD_TOPE; edad++) {
      if (numero(estratoDeEscalon(horizonteEn(banda, edad)).romano) >= numero(delPuesto)) {
        edadDelPuesto = edad;
        break;
      }
    }
  }

  /* En cuánto tiempo alcanzaría el nivel del puesto, dicho en tramos y no con
     una edad: la cuenta sale de un plazo estimado por la evaluadora y de
     bandas anchas, y "a los 44 años" aparenta una precisión que el método no
     tiene. Va adentro del recuadro, en el diagnóstico, porque cambia cómo se
     lee la acción: una supervisión de dos años y una de más de diez no son la
     misma decisión. */
  const faltan = edadDelPuesto !== null && d.punto ? edadDelPuesto - Math.floor(d.punto.edad) : null;
  const cuando =
    !d.punto || alcanza === null || alcanza >= 0
      ? ''
      : faltan === null
        ? ` Por su edad y su capacidad actual, no alcanzaría el nivel ${numero(delPuesto)} antes de los ${EDAD_TOPE} años.`
        : ` Por su edad y su capacidad actual, alcanzaría el nivel ${numero(delPuesto)} ${
            faltan < 5 ? 'en menos de 5 años' : faltan <= 10 ? 'en un plazo de 5 a 10 años' : 'en más de 10 años'
          }.`;

  /* Cuando el puesto ya le alcanza, queda la oración que explica la marca
     "podría llegar con los años" de la pirámide. */
  const maduracion: string | null =
    d.punto && (alcanza === null || alcanza >= 0) && futuro && futuro !== hoy
      ? `Por su edad (${d.punto.edad} años) y por el alcance del trabajo que hoy maneja, alrededor de los 50 estaría en condiciones de asumir trabajo del nivel «${COMO_SE_LLAMA[futuro]?.nombre.toLowerCase()}».`
      : null;

  /* La respuesta, con el color del semáforo del informe. Son cuatro y no
     tres: quedar un nivel por debajo se cubre con acompañamiento y va en
     amarillo; quedar dos o más no, y decir ahí "entrar igual es posible"
     prometía de más. */
  const DISTANCIA = ['', 'un nivel', 'dos niveles', 'tres niveles', 'cuatro niveles'];
  const estrato = (r: string | null) => NIVELES.find((e) => e.romano === r) ?? null;
  /** "de 1 año a 2 años", "hasta 3 meses": el plazo de las decisiones de un nivel. */
  const plazo = (r: string | null) => {
    const e = estrato(r);
    return e ? plazoDe(e).charAt(0).toLowerCase() + plazoDe(e).slice(1) : '';
  };
  /**
   * El plazo dicho de corrido, para ir detrás de "en un plazo": "de 5 a 10
   * años", "de 3 meses a 1 año", "de hasta 3 meses". Suelto, "de 5 años a 10
   * años" no decía de qué era el plazo y repetía la unidad.
   */
  const plazoCorto = (r: string | null) => {
    const p = plazo(r);
    if (p.startsWith('hasta ')) return `de ${p}`;
    const m = p.match(/^de (\S+) (años?|mes(?:es)?) a (.+)$/);
    if (!m) return p;
    const mismaUnidad = m[3].includes(m[2].slice(0, 3));
    return mismaUnidad ? `de ${m[1]} a ${m[3]}` : p;
  };
  /** El plazo más largo de un nivel: "1 año", "3 meses". */
  const techo = (r: string | null) => plazo(r).replace(/^hasta /, '').split(' a ').pop() ?? '';

  /* Diagnóstico y después acción, en ese orden y de corrido, sin rótulos: primero qué
     exige el puesto y dónde está la persona, en los números de la pirámide de
     abajo, y después qué hacer con eso. */
  const exige = `El puesto exige el nivel ${numero(delPuesto)}`;
  const cierre: {
    color: 'verde' | 'azul' | 'ambar' | 'rojo';
    titulo: string;
    diagnostico: string;
    accion: string;
  } | null =
    alcanza === null
      ? null
      : alcanza === 0
        ? {
            color: 'verde',
            titulo: 'En el nivel requerido para el puesto',
            diagnostico: `${exige} y la persona ya decide con autonomía en ese nivel.`,
            accion: 'Puede ingresar sin supervisión adicional.',
          }
        : alcanza > 0
          ? {
              color: 'azul',
              titulo: 'Por encima de lo requerido para el puesto',
              diagnostico: `${exige}. La persona decide con autonomía en el nivel ${numero(hoy)}.`,
              accion:
                'Puede ingresar sin supervisión adicional. Conviene prever tareas de mayor alcance para cuando domine el puesto.',
            }
          : alcanza === -1
            ? {
                color: 'ambar',
                titulo: 'Un nivel por debajo de lo requerido para el puesto',
                diagnostico: `${exige}. Hoy la persona decide con autonomía en el nivel ${numero(hoy)}.${cuando}`,
                accion: `Puede ingresar si su líder supervisa las decisiones cuyo resultado se ve a más de ${techo(hoy)}.`,
              }
            : {
                color: 'rojo',
                titulo: `${DISTANCIA[-alcanza].charAt(0).toUpperCase()}${DISTANCIA[-alcanza].slice(1)} por debajo de lo requerido para el puesto`,
                diagnostico: `${exige}. Hoy la persona decide con autonomía en el nivel ${numero(hoy)}.${cuando}`,
                accion: `Este puesto no se recomienda: la supervisión del líder no cubre ${DISTANCIA[-alcanza]} de diferencia. Considerar a la persona para un puesto de nivel ${numero(hoy)} o ${numero(hoy) + 1}.`,
              };

  return (
    <div className="sitio-escalera">
      {/* La respuesta primero: si le alcanza o no para el puesto. Es lo que
          el cliente viene a buscar, y la escalera y su explicación vienen
          después, como respaldo. */}
      {cierre && (
        <>
          {/* La misma tarjeta del nivel de ajuste de la primera página: el
              ícono, el resultado como título y debajo el texto, más liviano. */}
          <article className={`inf-nivel ${cierre.color} elegido sitio-escalera-nivel`}>
            <IconoNivel clave={ICONO[cierre.color]} />
            <div>
              <h3>{cierre.titulo}</h3>
              <p>
                {cierre.diagnostico} {cierre.accion}
              </p>
            </div>
          </article>
          {/* Los otros resultados, en etiquetas de color, como los otros
              niveles de ajuste en la primera página: dicen que es una escala y
              dónde cayó esta persona. */}
          <p className="inf-nota sitio-escalera-otros">
            Otros resultados posibles:{' '}
            {RESULTADOS.filter((r) => r.color !== cierre.color).map((r, i) => (
              <span key={r.color}>
                {i > 0 && ' '}
                <span className={`inf-nivel-tag ${r.color}`}>{r.etiqueta}</span>
              </span>
            ))}
          </p>
        </>
      )}

      <p className="sitio-escalera-intro">
        {/* Qué se está mirando, antes de la escalera: sin esto los escalones se
            leen como una calificación de la persona. */}
        La escalera ordena el trabajo en cinco niveles de complejidad. Cada nivel se define por el
        horizonte de sus decisiones: el tiempo que pasa hasta que se puede verificar si una decisión
        fue correcta, desde algunos meses en el primer nivel hasta varios años en el quinto.
      </p>

      {/* La pirámide a la derecha y, a la izquierda de cada escalón, su
          franja: el número del nivel, qué trabajo es y las marcas de dónde
          cae el puesto y dónde la persona. La franja pasa por detrás del
          escalón, así cada texto queda atado al suyo sin una línea que los
          una. */}
      <ol className="sitio-piramide">
        {NIVELES.slice()
          .reverse()
          .map((e, i) => {
            const info = COMO_SE_LLAMA[e.romano];
            const marcas = [
              delPuesto === e.romano ? { clave: 'puesto', texto: 'Lo que pide el puesto' } : null,
              hoy === e.romano ? { clave: 'hoy', texto: 'Puede hoy' } : null,
              futuro === e.romano && futuro !== hoy
                ? { clave: 'futuro', texto: 'Podría llegar con los años' }
                : null,
            ].filter(Boolean) as { clave: string; texto: string }[];
            const enCara = i >= 2;

            return (
              <li
                key={e.romano}
                className={['sitio-escalon', ...marcas.map((m) => `es-${m.clave}`)].join(' ')}
                /* Qué parte del ancho de la pirámide ocupa el escalón arriba
                   y abajo: sale de su lugar en la pila, así los lados de los
                   cinco caen sobre la misma recta. */
                style={
                  {
                    '--arriba': i / NIVELES.length,
                    '--abajo': (i + 1) / NIVELES.length,
                  } as CSSProperties
                }
              >
                <span className="sitio-escalon-num">{numero(e.romano)}</span>
                <div className="sitio-escalon-texto">
                  {/* En los dos escalones de arriba las marcas van al lado del
                      nombre: ahí el escalón es angosto y adentro no entran. */}
                  <div className="sitio-escalon-cabeza">
                    <h4>{info.nombre}</h4>
                    {(enCara ? [] : marcas).map((m) => (
                      <span key={m.clave} className={`sitio-donde ${m.clave}`}>
                        {m.texto}
                      </span>
                    ))}
                  </div>
                  {/* A qué puestos se parece y con qué plazo se maneja. */}
                  {/* Una sola oración por nivel: cómo se decide ahí y en qué
                      plazo se verifica el resultado, que es lo que define al
                      nivel. Eran dos renglones sueltos, el plazo por un lado y
                      la manera de decidir por otro. */}
                  <p className="sitio-escalon-que">
                    {info.decide}, con resultados que se verifican en un plazo{' '}
                    {plazoCorto(e.romano)}.
                  </p>
                </div>
                {/* Del tercer escalón para abajo las marcas van escritas
                    adentro del escalón, que ahí ya tiene ancho: en la franja
                    le sumaban un renglón a su fila y, como las cinco miden lo
                    mismo, a toda la pirámide. */}
                <span className="sitio-escalon-cara">
                  {enCara &&
                    marcas.map((m) => (
                      <span key={m.clave} className={`sitio-escalon-marca ${m.clave}`}>
                        {m.texto}
                      </span>
                    ))}
                </span>
              </li>
            );
          })}
      </ol>

      {maduracion && <p className="sitio-escalera-nota">{maduracion}</p>}

      {/* La distancia entre lo que puede y lo que le dan. Va antes de la
          fundamentación porque cambia cómo se lee todo lo anterior. */}
      {d.brecha > 0 && (
        <p className="sitio-escalera-aviso">
          {d.brecha === 1
            ? 'El trabajo que tiene asignado hoy responde por tareas de un nivel por ' +
              'debajo del que muestra su manera de razonar: el puesto que ocupa no le ' +
              'está pidiendo todo lo que puede.'
            : `El trabajo que tiene asignado hoy responde por tareas de ${d.brecha} niveles ` +
              'por debajo del que muestra su manera de razonar: el puesto que ocupa no le ' +
              'está pidiendo todo lo que puede.'}
        </p>
      )}

      {/* Lo único del capítulo escrito por quien firma el informe. */}
      {d.fundamentacion && (
        <div className="sitio-escalera-firma">
          <h4>Fundamentación de la evaluadora</h4>
          {d.fundamentacion
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (
              <p key={t}>{t}</p>
            ))}
        </div>
      )}
    </div>
  );
}
