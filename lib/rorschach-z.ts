/**
 * Cuándo una respuesta recibe puntaje Z, y cuál.
 *
 * Las situaciones, como las definieron las psicólogas (el 10/9/2026 cambiaron
 * quién decide la integración: ya no es un tilde, es el DQ):
 *
 *   ZW  respuesta W con DQ+ o DQo. Las W con vaga adentro (DQv y DQv/+) no
 *       reciben Z: una respuesta vaga no organiza nada.
 *   ZA  respuesta con DQ+ (W, D o Dd) sobre dos o más áreas **adyacentes**,
 *       las que se tocan.
 *   ZD  lo mismo sobre áreas **distantes**.
 *   ZS  el blanco junto con la tinta: en una W con DQo o DQ+ (WSo también
 *       puntúa), o en cualquier respuesta con DQ+.
 *
 * **La relación significativa la asegura el DQ+.** Una Do o una Ddo con dos
 * áreas marcadas son dos partes nombradas sin relación, y no llevan Z. Por eso
 * no hay nada que tildar: elegido el DQ, el Z sale solo.
 *
 * Lo importante de ZS, y es lo que más se presta a error: una respuesta ubicada
 * solo en el blanco NO recibe ZS por ser S. "Una cara en el blanco" es S y nada
 * más; "una cara donde el blanco son los ojos y la tinta el resto" integra las
 * dos cosas y ahí sí hay ZS.
 *
 * Adyacente o distante lo dice la lámina, no quien codifica: sale de
 * `ADYACENTES`, medido sobre la geometría de las áreas. Cuando dan varios, se
 * anota uno solo, el más alto.
 *
 * Los valores salen del encabezado de cada lámina del cuadernillo y están en
 * `Z`, dentro de `rorschach-tabla-a.ts`, para las diez. Los de la I son ZW 1.0,
 * ZA 4.0, ZD 6.0, ZS 3.5.
 */

import { ADYACENTES, CONTENIDAS } from './rorschach-areas.ts';
import { familiaDe, Z } from './rorschach-tabla-a.ts';

export type TipoZ = 'ZW' | 'ZA' | 'ZD' | 'ZS';

export type Situacion = {
  /** Las áreas que la evaluadora marcó para esta respuesta. */
  areas: string[];
  /** La localización con su calidad evolutiva ('Wo', 'DdSv/+'), o null. */
  localizacion: string | null;
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
export function areasDistintas(lamina: string, areas: string[]): string[] {
  const dentro = CONTENIDAS[lamina] ?? {};
  return areas.filter((a) => !areas.some((b) => b !== a && (dentro[b] ?? []).includes(a)));
}

/**
 * La localización de una respuesta que cae en varias áreas.
 *
 * La ficha lleva un solo código por respuesta, y lo definieron las psicólogas
 * el 10/9/2026:
 *
 *   · Si alguna es W, la respuesta es W, sin número: las demás quedan adentro.
 *   · Si son todas D, es D con los números sumados ("3+1").
 *   · Si se mezclan D con Dd, o hay alguna que no está estandarizada, es Dd99.
 *
 * Con blanco en cualquiera de las áreas, la familia lleva S (WS, DS, DdS). Las
 * áreas contenidas en otra no cuentan: D4 con Dd21 adentro es D4. Y no importa
 * en qué orden se marcaron, que es lo que decidía antes: la primera área.
 */
export function localizacionFinal(
  lamina: string,
  areas: string[]
): { familia: ReturnType<typeof familiaDe>; numero: string | null } {
  const distintas = areasDistintas(lamina, areas);
  const numeroDe = (a: string) => a.replace(/^(WS?|D?d?S?)/, '') || null;
  if (distintas.length <= 1) {
    const a = distintas[0] ?? areas[0] ?? 'Dd99';
    return { familia: familiaDe(a), numero: numeroDe(a) };
  }
  const conS = distintas.some(esEspacio);
  const familias = distintas.map(familiaDe);
  if (familias.some((f) => f === 'W' || f === 'WS')) {
    return { familia: conS ? 'WS' : 'W', numero: null };
  }
  if (familias.every((f) => f === 'D' || f === 'DS')) {
    return {
      familia: conS ? 'DS' : 'D',
      numero: distintas.map(numeroDe).filter(Boolean).join('+') || null,
    };
  }
  return { familia: conS ? 'DdS' : 'Dd', numero: '99' };
}

/** Si dos áreas se tocan en la lámina. */
export function sonAdyacentes(lamina: string, a: string, b: string): boolean {
  const vecinas = ADYACENTES[lamina] ?? {};
  return (vecinas[a] ?? []).includes(b) || (vecinas[b] ?? []).includes(a);
}

export function puntajeZ(lamina: string, s: Situacion): Veredicto {
  const valores = Z[lamina];
  const aConfirmar: string[] = [];
  if (!valores) return { z: null, otros: [], aConfirmar: ['No están cargados los valores de Z de esta lámina.'] };

  const candidatos: Candidato[] = [];

  // -- ZW: la respuesta toma la mancha entera y no es vaga.
  const loc = s.localizacion;
  if (loc && loc.startsWith('W')) {
    const dq = dqDe(loc);
    if (dq === 'o' || dq === '+') {
      candidatos.push({ tipo: 'ZW', valor: valores.ZW, porque: `${loc}: W con DQ${dq}` });
    }
    // Wv y Wv/+ no puntúan: las dos llevan vaga adentro, y una respuesta vaga
    // no organiza nada. Por eso el corte es "tiene v" y no "es exactamente v".
  }

  // -- ZA y ZD: la relación la asegura el DQ+.
  const dq = loc ? dqDe(loc) : null;
  const distintas = areasDistintas(lamina, s.areas);
  if (distintas.length >= 2 && !loc) {
    aConfirmar.push(
      `Marcaste ${distintas.join(' y ')}. Con DQ+ hay ZA o ZD; con DQo o vaga, no hay Z.`
    );
  }
  if (distintas.length >= 2 && dq === '+') {
    let hayDistante = false;
    const pares: string[] = [];
    for (let i = 0; i < distintas.length; i++) {
      for (let j = i + 1; j < distintas.length; j++) {
        const juntas = sonAdyacentes(lamina, distintas[i], distintas[j]);
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

  // -- ZS: el blanco junto con la tinta. La W ya es tinta; una respuesta solo
  // en el blanco no integra nada.
  const esW = Boolean(loc && loc.startsWith('W'));
  const conEspacio = s.areas.some(esEspacio) || (loc ? llevaEspacio(loc) : false);
  const conTinta = esW || s.areas.some((a) => !esEspacio(a));
  if (conEspacio && conTinta && (dq === '+' || (esW && dq === 'o'))) {
    candidatos.push({ tipo: 'ZS', valor: valores.ZS, porque: 'el blanco se integra con la tinta' });
  }

  if (candidatos.length === 0) return { z: null, otros: [], aConfirmar };

  // Cuando dan varias, se toma la más alta y se anota una sola Z por respuesta.
  const orden = [...candidatos].sort((a, b) => b.valor - a.valor);
  return { z: orden[0], otros: orden.slice(1), aConfirmar };
}
