/**
 * Verifica el reparto del ejercicio de las frases de la charla 5.
 *
 *   node --experimental-strip-types scripts/verificar-frases.ts
 *
 * Dos cosas: que en cada frase las dos mitades vayan en direcciones opuestas,
 * que es lo que hace que la respuesta de una sea el punto de partida de la
 * otra; y que cada mitad pase por las dos direcciones, dos frases de cada una.
 */
import { direccionDe, repartoFrases, MITADES, COLORES } from '../lib/frases.ts';

let mal = 0;

console.log('DIRECCIÓN POR FRASE\n');
const filas = [0, 1, 2, 3].map((i) => {
  const a = direccionDe('a', i);
  const b = direccionDe('b', i);
  if (a === b) mal++;
  return { frase: i + 1, 'Team A': a, 'Team B': b, cruzadas: a !== b ? 'sí' : 'NO' };
});
console.table(filas);

for (const m of MITADES) {
  const suyas = [0, 1, 2, 3].map((i) => direccionDe(m, i));
  const objetivo = suyas.filter((d) => d === 'objetivo').length;
  const subjetivo = suyas.filter((d) => d === 'subjetivo').length;
  console.log(`Team ${m.toUpperCase()}: ${objetivo} hacia el hecho, ${subjetivo} hacia la interpretación`);
  if (objetivo !== 2 || subjetivo !== 2) mal++;
}

console.log('\nEQUIPOS SEGÚN CUÁNTA GENTE HAY\n');
const salas = [28, 30, 32, 33, 34, 36, 40].map((n) => {
  const eq = repartoFrases(Array.from({ length: n }, (_, i) => `p${i}`));
  const tamaños = eq.map((e) => e.puestos.length);
  const escriben = eq.map(
    (e) => e.puestos.filter((p) => p.escribe).length
  );
  const mitades = eq.map(
    (e) =>
      `${e.puestos.filter((p) => p.mitad === 'a').length}/${e.puestos.filter((p) => p.mitad === 'b').length}`
  );
  // Cada equipo tiene que tener exactamente dos que escriben, uno por mitad.
  if (escriben.some((c) => c !== 2)) mal++;
  // Y nadie puede quedar sin equipo.
  if (tamaños.reduce((s, t) => s + t, 0) !== n) mal++;
  return {
    personas: n,
    equipos: eq.length,
    tamaños: tamaños.join(' '),
    'A/B': mitades.join(' '),
    'escriben por equipo': escriben.join(' '),
    colores: eq.map((e) => COLORES[e.color]).join(' '),
  };
});
console.table(salas);

console.log(mal === 0 ? 'Todo bien.' : `${mal} caso(s) mal.`);
process.exit(mal === 0 ? 0 : 1);
