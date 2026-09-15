/**
 * Verifica la regla del puntaje Z contra los casos que dictó la evaluadora.
 *
 *   node --experimental-strip-types scripts/verificar-z.ts
 *
 * Son nueve casos que cubren las cuatro situaciones y los tres bordes donde es
 * fácil equivocarse: la W vaga, la respuesta que está solo en el blanco, y las
 * dos áreas donde una es parte de la otra.
 */
import { localizacionFinal, puntajeZ, type Situacion } from '../lib/rorschach-z.ts';

type Caso = { que: string; s: Situacion; espera: string };

const CASOS: Caso[] = [
  {
    que: 'W con DQo',
    s: { areas: ['W'], localizacion: 'Wo' },
    espera: 'ZW 1',
  },
  {
    que: 'W con DQ+',
    s: { areas: ['W'], localizacion: 'W+' },
    espera: 'ZW 1',
  },
  {
    // Las dos llevan vaga adentro y una respuesta vaga no organiza nada.
    que: 'W con DQv',
    s: { areas: ['W'], localizacion: 'Wv' },
    espera: 'sin Z',
  },
  {
    que: 'W con DQv/+',
    s: { areas: ['W'], localizacion: 'Wv/+' },
    espera: 'sin Z',
  },
  {
    // D1 y D2 se tocan en la lámina.
    que: 'dos áreas adyacentes, integradas',
    s: { areas: ['D1', 'D2'], localizacion: 'D+' },
    espera: 'ZA 4',
  },
  {
    // D7 y Dd31 son el ala de arriba y el pie: no se tocan por ningún lado.
    // El caso usaba D4 y D7, que dejaron de servir cuando D4 se corrigió y pasó
    // a llegar hasta los cuernos: ahí sí toca el ala, y el par es adyacente.
    que: 'dos áreas distantes, integradas',
    s: { areas: ['D7', 'Dd31'], localizacion: 'D+' },
    espera: 'ZD 6',
  },
  {
    // La relación la asegura el DQ+: con DQo son dos partes nombradas sin
    // relación entre ellas.
    que: 'dos áreas con DQo',
    s: { areas: ['D1', 'D2'], localizacion: 'Do' },
    espera: 'sin Z',
  },
  {
    // Dd21 es una parte de D4: no son dos áreas.
    que: 'un área adentro de la otra',
    s: { areas: ['D4', 'Dd21'], localizacion: 'D+' },
    espera: 'sin Z',
  },
  {
    // Estar en el blanco es S y nada más.
    que: 'la respuesta está solo en el blanco',
    s: { areas: ['DdS26'], localizacion: 'DdSo' },
    espera: 'sin Z',
  },
  {
    // Blanco y tinta sin DQ+ fuera de la W: es una Do, y no lleva Z.
    que: 'el blanco con la tinta, con DQo',
    s: { areas: ['DdS26', 'D4'], localizacion: 'DSo' },
    espera: 'sin Z',
  },
  {
    // ZS 3.5 le gana a ZW 1: se anota una sola Z, la más alta.
    que: 'W que además integra el blanco',
    s: { areas: ['W', 'DdS29'], localizacion: 'WSo' },
    espera: 'ZS 3.5',
  },
];

/** La localización final de una respuesta en varias áreas, lámina I. */
const LOCALIZACIONES: { que: string; areas: string[]; espera: string }[] = [
  { que: 'W con un Dd adentro', areas: ['Dd21', 'W'], espera: 'W' },
  { que: 'W con blanco', areas: ['W', 'DdS29'], espera: 'WS' },
  { que: 'dos D', areas: ['D3', 'D1'], espera: 'D 3+1' },
  { que: 'D con un Dd de afuera', areas: ['D7', 'Dd31'], espera: 'Dd 99' },
  { que: 'un Dd adentro de su D', areas: ['D4', 'Dd21'], espera: 'D 4' },
];

let mal = 0;
for (const { que, areas, espera } of LOCALIZACIONES) {
  const l = localizacionFinal('I', areas);
  const dio = [l.familia, l.numero].filter(Boolean).join(' ');
  if (dio !== espera) mal++;
  console.log(`${dio === espera ? 'sí' : 'NO'}  ${que}: espera ${espera}, dio ${dio}`);
}

const filas = CASOS.map(({ que, s, espera }) => {
  const v = puntajeZ('I', s);
  const dio = v.z ? `${v.z.tipo} ${v.z.valor}` : 'sin Z';
  if (dio !== espera) mal++;
  return {
    caso: que,
    espera,
    dio,
    ok: dio === espera ? 'sí' : 'NO',
    porque: v.z?.porque ?? (v.aConfirmar[0] ? 'pregunta a la evaluadora' : ''),
  };
});

console.table(filas);
console.log(mal === 0 ? '✓ La regla hace lo que dice.' : `✗ ${mal} caso(s) mal.`);
process.exit(mal === 0 ? 0 : 1);
