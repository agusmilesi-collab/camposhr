import type { Informe } from '@/lib/informe';
import {
  ESTRATOS,
  PREGUNTAS,
  bandaDe as bandaDelPotencial,
  enPalabras,
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
const COMO_SE_LLAMA: Record<string, { nombre: string; ejemplo: string }> = {
  I: {
    nombre: 'Hacer el trabajo del día',
    ejemplo: 'Un operario, un administrativo, un vendedor de mostrador.',
  },
  II: {
    nombre: 'Resolver lo que se sale del libreto',
    ejemplo: 'Un supervisor, un analista, un jefe de turno.',
  },
  III: {
    nombre: 'Organizar todo un frente de trabajo',
    ejemplo: 'Un jefe de área, un jefe de planta, un responsable comercial.',
  },
  IV: {
    nombre: 'Manejar varios frentes a la vez',
    ejemplo: 'Una gerencia con varias áreas a cargo.',
  },
  V: {
    nombre: 'Conducir el negocio entero',
    ejemplo: 'Una dirección general o la conducción de una unidad de negocio.',
  },
};

/** Los cinco que se usan: del sexto para arriba son corporaciones. */
const NIVELES = ESTRATOS.slice(0, 5);

export default function Escalera({ inf }: { inf: Informe }) {
  const d = inf.discursivo;
  if (!d) return null;

  const hoy = d.detalle?.romano ?? null;
  const delPuesto = d.puesto?.romano ?? null;

  /* Hasta dónde llega con los años: la banda de maduración que lo contiene,
     leída a los 50, que es donde la curva ya se aplanó. */
  const futuro = d.punto ? estratoDeEscalon(horizonteEn(bandaDelPotencial(d.punto.edad, d.punto.dias), 50)).romano : null;

  const numero = (r: string | null) => (r ? NIVELES.findIndex((e) => e.romano === r) + 1 : 0);
  const alcanza = hoy && delPuesto ? numero(hoy) - numero(delPuesto) : null;

  return (
    <div className="sitio-escalera">
      <p className="sitio-escalera-intro">
        {/* Qué se está mirando, antes de la escalera: sin esto los escalones se
            leen como una calificación de la persona. */}
        Cuanto más arriba, más lejos en el tiempo hay que ver para hacer bien ese trabajo.
        No es cuánto sabe ni cuánto se esfuerza: es qué tan grande puede ser el problema
        que maneja sin que se le desarme.
      </p>

      <ol className="sitio-niveles">
        {NIVELES.slice().reverse().map((e) => {
          const info = COMO_SE_LLAMA[e.romano];
          const mecanismo = PREGUNTAS.find((p) => p.estrato === numero(e.romano));
          const marcas = [
            delPuesto === e.romano ? { clave: 'puesto', texto: 'Lo que pide el puesto' } : null,
            hoy === e.romano ? { clave: 'hoy', texto: 'Puede hoy' } : null,
            futuro === e.romano && futuro !== hoy
              ? { clave: 'futuro', texto: 'Podría llegar con los años' }
              : null,
          ].filter(Boolean) as { clave: string; texto: string }[];

          return (
            <li
              key={e.romano}
              className={`sitio-nivel${marcas.length ? ' marcado' : ''}`}
              data-nivel={e.romano}
            >
              <div className="sitio-nivel-cuerpo">
                <h4>{info.nombre}</h4>
                <p className="sitio-nivel-que">{mecanismo?.simple}</p>
                <p className="sitio-nivel-ej">{info.ejemplo}</p>
              </div>
              <div className="sitio-nivel-lado">
                <span className="sitio-nivel-plazo">{plazoDe(e)}</span>
                {marcas.map((m) => (
                  <span key={m.clave} className={`sitio-donde ${m.clave}`}>
                    {m.texto}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Lo que hay que contestar, escrito. La escalera lo muestra, pero quien
          lee un informe quiere leerlo dicho. */}
      {alcanza !== null && (
        <p className="sitio-escalera-cierre">
          {alcanza === 0
            ? 'El trabajo que esta persona puede manejar hoy es del mismo tamaño que el que el puesto le va a pedir.'
            : alcanza > 0
              ? 'El trabajo que esta persona puede manejar hoy es más grande que el que el puesto le va a pedir. Va a poder con el puesto, y conviene tener en cuenta que le puede quedar chico en cuanto lo domine.'
              : 'El trabajo que el puesto pide es más grande que el que esta persona puede manejar hoy. Entrar igual es posible, y en ese caso hay que acompañarla de cerca en las decisiones que abran más de un camino.'}
        </p>
      )}

      {d.punto && futuro && (
        <p className="sitio-escalera-nota">
          Esa capacidad crece con los años y lo hace por caminos regulares. Por la edad de
          la persona ({d.punto.edad} años) y por el alcance de lo que hoy maneja
          ({enPalabras(d.punto.dias)}), alrededor de los 50 estaría en condiciones de
          manejar trabajo del nivel «{COMO_SE_LLAMA[futuro]?.nombre.toLowerCase()}». Es un
          ritmo probable y no una carrera dictaminada.
        </p>
      )}

      {/* Dónde cae dentro de ese nivel, que es la subdivisión del propio
          modelo. En el medio no se dice: es lo esperable. */}
      {d.celda === 'A' && (
        <p className="sitio-escalera-nota">
          Está en el borde de arriba de ese nivel: sostiene la manera de pensar que le
          corresponde y ya asoma la del nivel siguiente.
        </p>
      )}
      {d.celda === 'B' && (
        <p className="sitio-escalera-nota">
          Está en el comienzo de ese nivel: recién está entrando en esa manera de pensar.
        </p>
      )}

      {/* Que el número describe al puesto que ocupa y no a su techo. Va antes
          de la fundamentación porque cambia cómo se lee todo lo anterior. */}
      {d.subutilizado && (
        <p className="sitio-escalera-aviso">
          El instrumento mide el alcance del trabajo que la persona tiene asignado hoy. El
          puesto que ocupa no le exige lo que puede, así que lo que se leyó arriba describe
          a ese puesto y queda por debajo de lo que la persona podría manejar.
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

      {/* De dónde sale: el instrumento, nombrado una vez y al pie. */}
      <p className="sitio-fuente">
        Sale del análisis discursivo sobre cinco minutos del relato de la persona, según el
        modelo de niveles de trabajo de Elliott Jaques. El detalle técnico está en
        Indicadores.
      </p>
    </div>
  );
}
