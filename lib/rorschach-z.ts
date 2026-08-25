/**
 * Cuándo una respuesta recibe puntaje Z, y cuál.
 *
 * Las cuatro situaciones, como las dictó la evaluadora:
 *
 *   ZW  respuesta W con DQ+ o DQo. Las W con DQv no reciben Z.
 *   ZA  se integran dos o más áreas **adyacentes** de la mancha en una sola
 *       respuesta, con una relación significativa entre ellas.
 *   ZD  se integran dos o más áreas **distantes**.
 *   ZS  se integra el espacio blanco con una zona de tinta.
 *
 * Lo importante de ZS, y es lo que más se presta a error: una respuesta ubicada
 * solo en el blanco NO recibe ZS por ser S. "Una cara en el blanco" es S y nada
 * más; "una cara donde el blanco son los ojos y la tinta el resto" integra las
 * dos cosas y ahí sí hay ZS.
 *
 * Qué resuelve el sistema y qué no:
 *
 *   · ZW sale solo, en cuanto está elegida la localización con su DQ.
 *   · Adyacente o distante lo dice la lámina, no quien codifica: sale de
 *     `ADYACENTES`, medido sobre la geometría de las áreas.
 *   · Que la integración exista y sea significativa lo dice la evaluadora. Dos
 *     áreas marcadas no son una integración: pueden ser dos partes nombradas al
 *     pasar. Sin esa confirmación no se propone ni ZA ni ZD.
 *   · Que el blanco esté integrado con la tinta también lo dice ella, por lo
 *     mismo.
 *
 * Los valores salen del encabezado de cada lámina del cuadernillo. Los de la I
 * son ZW 1.0, ZA 4.0, ZD 6.0, ZS 3.5.
 */

import { ADYACENTES, CONTENIDAS } from './rorschach-areas';
import { LAMINAS } from './rorschach-tabla-a';

export type TipoZ = 'ZW' | 'ZA' | 'ZD' | 'ZS';

export type Situacion = {
  /** Las áreas que la evaluadora marcó para esta respuesta. */
  areas: string[];
  /** La localización con su calidad evolutiva ('Wo', 'DdSv/+'), o null. */
  localizacion: string | null;
  /** Ella confirma que las áreas están integradas con relación significativa. */
  integradas: boolean;
  /** Ella confirma que el blanco entra junto con la tinta en la respuesta. */
  blancoIntegrado: boolean;
};

export type Candidato = {
  tipo: TipoZ;
  valor: number;
  porque: string;
};

export type Veredicto = {
  /** El que corresponde, o null si no hay Z. */
  z: Candidato | null;
  /** Los otros que también daban, para que se vea por qué ganó uno. */
  otros: Candidato[];
  /** Lo que el sistema no puede decidir y tiene que mirar ella. */
  aConfirmar: string[];
};

/** La calidad evolutiva que trae la localización: 'Wo' da 'o', 'Ddv/+' da 'v/+'. */
export function dqDe(localizacion: string): string | null {
  const m = localizacion.match(/(v\/\+|o|v|\+)$/);
  return m ? m[1] : null;
}

/** Si la localización involucra espacio blanco (WS, DS, DdS). */
export function llevaEspacio(localizacion: string): boolean {
  return localizacion.includes('S');
}

/** Si un área es espacio blanco. */
export function esEspacio(area: string): boolean {
  return area.includes('S');
}

/**
 * Las áreas que cuentan como distintas.
 *
 * Elegir D4 y Dd21 no es integrar dos zonas: Dd21 es una parte de D4. Se
 * descarta la contenida y queda la que la contiene.
 */
export function areasDistintas(areas: string[]): string[] {
  return areas.filter(
    (a) => !areas.some((b) => b !== a && (CONTENIDAS[b] ?? []).includes(a))
  );
}

/** Si dos áreas se tocan en la lámina. */
export function sonAdyacentes(a: string, b: string): boolean {
  return (ADYACENTES[a] ?? []).includes(b) || (ADYACENTES[b] ?? []).includes(a);
}

export function puntajeZ(lamina: string, s: Situacion): Veredicto {
  const valores = LAMINAS[lamina]?.z;
  const aConfirmar: string[] = [];
  if (!valores) return { z: null, otros: [], aConfirmar: ['No están cargados los valores de Z de esta lámina.'] };

  const candidatos: Candidato[] = [];

  // -- ZW: la respuesta toma la mancha entera y no es vaga.
  const loc = s.localizacion;
  if (loc && loc.startsWith('W')) {
    const dq = dqDe(loc);
    if (dq === 'o' || dq === '+') {
      candidatos.push({ tipo: 'ZW', valor: valores.ZW, porque: `${loc}: W con DQ${dq}` });
    } else if (dq === 'v/+') {
      // La regla dictada dice "+ o o", y nombra solo DQv como la que no puntúa.
      // v/+ no cae de ningún lado, así que no se decide sola.
      aConfirmar.push(`${loc}: una W con DQv/+, ¿recibe ZW? La regla nombra DQ+ y DQo, y deja afuera DQv.`);
    }
    // Wv no puntúa y no hace falta avisar: está dicho en la regla.
  }

  // -- ZA y ZD: integrar áreas.
  const distintas = areasDistintas(s.areas);
  if (distintas.length >= 2) {
    if (!s.integradas) {
      aConfirmar.push(
        `Marcaste ${distintas.join(' y ')}. Si hay una relación significativa entre ellas, es ZA o ZD; si solo las nombró por separado, no hay Z.`
      );
    } else {
      let hayDistante = false;
      const pares: string[] = [];
      for (let i = 0; i < distintas.length; i++) {
        for (let j = i + 1; j < distintas.length; j++) {
          const juntas = sonAdyacentes(distintas[i], distintas[j]);
          if (!juntas) hayDistante = true;
          pares.push(`${distintas[i]}${juntas ? '+' : '·'}${distintas[j]}`);
        }
      }
      candidatos.push(
        hayDistante
          ? { tipo: 'ZD', valor: valores.ZD, porque: `áreas distantes: ${pares.join(', ')}` }
          : { tipo: 'ZA', valor: valores.ZA, porque: `áreas adyacentes: ${pares.join(', ')}` }
      );
    }
  }

  // -- ZS: el blanco junto con la tinta.
  const conEspacio = s.areas.some(esEspacio) || (loc ? llevaEspacio(loc) : false);
  const conTinta = s.areas.some((a) => !esEspacio(a));
  if (conEspacio) {
    if (!conTinta && !s.blancoIntegrado) {
      // Solo blanco: es S en la localización, y nada más. No se avisa nada
      // porque no hay nada que decidir.
    } else if (!s.blancoIntegrado) {
      aConfirmar.push(
        'Hay blanco y tinta en la respuesta. ¿El blanco se integra con la mancha? Solo así hay ZS: estar en el blanco no alcanza.'
      );
    } else if (!conTinta) {
      aConfirmar.push(
        'Marcaste que el blanco se integra, pero no hay ningún área de tinta elegida. Agregá la zona de tinta con la que se integra.'
      );
    } else {
      candidatos.push({ tipo: 'ZS', valor: valores.ZS, porque: 'el blanco se integra con la tinta' });
    }
  }

  if (candidatos.length === 0) return { z: null, otros: [], aConfirmar };

  // Cuando dan varias, se toma la más alta y se anota una sola Z por respuesta.
  const orden = [...candidatos].sort((a, b) => b.valor - a.valor);
  return { z: orden[0], otros: orden.slice(1), aConfirmar };
}
