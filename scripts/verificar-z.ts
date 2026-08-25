/**
 * Verifica la regla del puntaje Z contra los casos que dictó la evaluadora.
 *
 *   node --experimental-strip-types scripts/verificar-z.ts
 *
 * Son nueve casos que cubren las cuatro situaciones y los tres bordes donde es
 * fácil equivocarse: la W vaga, la respuesta que está solo en el blanco, y las
 * dos áreas donde una es parte de la otra.
 */
import { puntajeZ, type Situacion } from '../lib/rorschach-z.ts';

type Caso = { que: string; s: Situacion; espera: string };

const CASOS: Caso[] = [
  {
    que: 'W con DQo',
    s: { areas: ['W'], localizacion: 'Wo', integradas: false, blancoIntegrado: false },
    espera: 'ZW 1',
  },
  {
    que: 'W con DQ+',
    s: { areas: ['W'], localizacion: 'W+', integradas: false, blancoIntegrado: false },
    espera: 'ZW 1',
  },
  {
    // Las dos llevan vaga adentro y una respuesta vaga no organiza nada.
    que: 'W con DQv',
    s: { areas: ['W'], localizacion: 'Wv', integradas: false, blancoIntegrado: false },
    espera: 'sin Z',
  },
  {
    que: 'W con DQv/+',
    s: { areas: ['W'], localizacion: 'Wv/+', integradas: false, blancoIntegrado: false },
    espera: 'sin Z',
  },
  {
    // D1 y D2 se tocan en la lámina.
    que: 'dos áreas adyacentes, integradas',
    s: { areas: ['D1', 'D2'], localizacion: 'D+', integradas: true, blancoIntegrado: false },
    espera: 'ZA 4',
  },
  {
    // D4 (el centro) y D7 (el ala) no se tocan: entre medio está D2.
    que: 'dos áreas distantes, integradas',
    s: { areas: ['D4', 'D7'], localizacion: 'D+', integradas: true, blancoIntegrado: false },
    espera: 'ZD 6',
  },
  {
    // Sin la confirmación no hay Z: dos áreas marcadas pueden ser dos partes
    // nombradas al pasar.
    que: 'dos áreas sin confirmar la integración',
    s: { areas: ['D1', 'D2'], localizacion: 'D+', integradas: false, blancoIntegrado: false },
    espera: 'sin Z',
  },
  {
    // Dd21 es una parte de D4: no son dos áreas.
    que: 'un área adentro de la otra',
    s: { areas: ['D4', 'Dd21'], localizacion: 'D+', integradas: true, blancoIntegrado: false },
    espera: 'sin Z',
  },
  {
    // Estar en el blanco es S y nada más.
    que: 'la respuesta está solo en el blanco',
    s: { areas: ['DdS26'], localizacion: 'DdSo', integradas: false, blancoIntegrado: false },
    espera: 'sin Z',
  },
  {
    que: 'el blanco integrado con la tinta',
    s: { areas: ['DdS26', 'D4'], localizacion: 'DSo', integradas: false, blancoIntegrado: true },
    espera: 'ZS 3.5',
  },
  {
    // ZS 3.5 le gana a ZW 1: se anota una sola Z, la más alta.
    que: 'W que además integra el blanco',
    s: { areas: ['W', 'DdS29'], localizacion: 'WSo', integradas: false, blancoIntegrado: true },
    espera: 'ZS 3.5',
  },
];

let mal = 0;
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
