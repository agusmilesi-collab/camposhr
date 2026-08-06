/**
 * Quién consulta a quién — el cruce de cuadrantes de la charla 3.
 *
 * La placa pide elegir a un par con un estilo distinto y consultarle una
 * decisión. Elegirlo a ojo tiene dos problemas conocidos de la sala: la gente
 * se junta con quien ya se lleva bien, que suele ser quien piensa parecido, y
 * los últimos en decidirse se quedan sin nadie. Acá lo reparte el sistema, con
 * el dato que la charla ya produjo: el cuadrante de cada uno.
 *
 * El cruce es recíproco. Si a una persona le toca otra, a esa le toca la
 * primera: se sientan de a dos y se consultan en las dos direcciones. Con
 * número impar queda un solo grupo de tres en toda la sala.
 *
 * Este módulo es puro y no toca la base: entra una lista de personas con su
 * cuadrante y salen los grupos. Así el reparto se puede probar sin encuentro.
 */

import { DIAGONAL, PERFILES, type Perfil } from './perfiles';

export type Candidato = {
  id: string;
  /** Null si todavía no respondió el cuestionario de perfil. */
  perfil: Perfil | null;
};

/**
 * Los ids que van juntos. De a 2, con un grupo de 3 cuando son impares. Puede
 * crecer más si entra gente después: al que llega tarde se lo suma a un grupo
 * ya armado en vez de desarmar los que están conversando.
 */
export type Grupo = string[];

/**
 * Por qué a esta persona le tocó la otra. Lo lee el teléfono para decir la
 * verdad en cada caso y no afirmar un contraste que no existe.
 */
export type Motivo = 'diagonal' | 'distinto' | 'mismo' | 'sin-perfil';

export function motivoEntre(mio: Perfil | null, suyo: Perfil | null): Motivo {
  if (!mio || !suyo) return 'sin-perfil';
  if (DIAGONAL[mio] === suyo) return 'diagonal';
  return mio === suyo ? 'mismo' : 'distinto';
}

/**
 * Reparte a todo el grupo en parejas.
 *
 * El orden de preferencia es el del guion:
 *
 *   1. la diagonal (FI con BD, FD con BI), que es el contraste más grande;
 *   2. cualquier otro cuadrante, tomando siempre de las dos pilas más
 *      cargadas, para que no quede una sola pila de cuatro personas sin nadie
 *      con quién cruzarse;
 *   3. quien no respondió el cuestionario, con quien haya quedado;
 *   4. y si al final sobra gente de un mismo cuadrante, se suma de a uno a los
 *      grupos ya armados, empezando por los que no tienen ese cuadrante.
 *
 * El resultado depende sólo de la lista de entrada: mismos asistentes con los
 * mismos cuadrantes dan siempre las mismas parejas. Sin eso, el sondeo del
 * teléfono le cambiaría el nombre a la persona cada cuatro segundos.
 */
export function armarGrupos(candidatos: Candidato[]): Grupo[] {
  // Por id, que no cambia. Alcanza para que dos corridas del reparto sobre la
  // misma gente den lo mismo.
  const gente = [...candidatos].sort((a, b) => a.id.localeCompare(b.id));
  if (gente.length < 2) return [];

  const perfilDe = new Map(gente.map((c) => [c.id, c.perfil]));
  const pilas: Record<Perfil, string[]> = { FI: [], FD: [], BI: [], BD: [] };
  const sinPerfil: string[] = [];
  for (const c of gente) {
    if (c.perfil) pilas[c.perfil].push(c.id);
    else sinPerfil.push(c.id);
  }

  const grupos: Grupo[] = [];

  // 1 · La diagonal, mientras haya de los dos lados.
  for (const [a, b] of [
    ['FI', DIAGONAL.FI],
    ['FD', DIAGONAL.FD],
  ] as [Perfil, Perfil][]) {
    while (pilas[a].length > 0 && pilas[b].length > 0) {
      grupos.push([pilas[a].shift()!, pilas[b].shift()!]);
    }
  }

  // 2 · Lo que sobró, con cualquier cuadrante distinto.
  while (true) {
    const conGente = conMasCarga(pilas);
    if (conGente.length < 2) break;
    grupos.push([pilas[conGente[0]].shift()!, pilas[conGente[1]].shift()!]);
  }

  // 3 · Quien no respondió el cuestionario. No sabemos si trabaja distinto,
  // así que va con quien haya quedado y el teléfono no afirma ningún contraste.
  while (sinPerfil.length > 0) {
    const conGente = conMasCarga(pilas);
    if (conGente.length === 0) break;
    grupos.push([sinPerfil.shift()!, pilas[conGente[0]].shift()!]);
  }
  while (sinPerfil.length >= 2) {
    grupos.push([sinPerfil.shift()!, sinPerfil.shift()!]);
  }

  const sueltos = [...PERFILES.flatMap((p) => pilas[p]), ...sinPerfil];

  // 4 · Lo que sobró es todo de un mismo cuadrante, así que ya no hay contraste
  // que buscar: se emparejan entre sí. Todos quedan de a dos.
  while (sueltos.length >= 2) {
    grupos.push([sueltos.shift()!, sueltos.shift()!]);
  }

  // 5 · Con número impar sobra exactamente una persona, y va de tercera al
  // grupo que no tenga su cuadrante, y entre esos al más chico. Un solo trío en
  // toda la sala: tres personas ya cuesta que se escuchen, y cuatro es una
  // reunión.
  for (const id of sueltos) {
    if (grupos.length === 0) break; // una sola persona: no hay con quién cruzar
    grupos.sort((a, b) => a.length - b.length || a[0].localeCompare(b[0]));
    const mio = perfilDe.get(id) ?? null;
    const destino =
      grupos.find((g) => g.every((otro) => perfilDe.get(otro) !== mio)) ?? grupos[0];
    destino.push(id);
  }

  return grupos;
}

/**
 * Los cuadrantes que todavía tienen gente, del más cargado al menos.
 * El desempate por el orden fijo de PERFILES es lo que mantiene el reparto
 * repetible.
 */
function conMasCarga(pilas: Record<Perfil, string[]>): Perfil[] {
  return PERFILES.filter((p) => pilas[p].length > 0).sort(
    (a, b) => pilas[b].length - pilas[a].length || PERFILES.indexOf(a) - PERFILES.indexOf(b)
  );
}
