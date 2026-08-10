/**
 * Verifica que las expositoras entren al ensayo sólo cuando faltan.
 *
 *   node --experimental-strip-types scripts/verificar-suplentes.ts
 *
 * Dos cosas: que la sala del ensayo siempre quede en múltiplo de tres cuando
 * alcanzan las dos suplentes, y que la que ya tiene puesto lo conserve aunque
 * después llegue alguien del taller y la cuenta cierre sin ella.
 */
import { conSuplentes, repartoEnsayo } from '../lib/ensayo.ts';

type Persona = { id: string; expositora: boolean };

function sala(taller: number, suplentes = 2): Persona[] {
  return [
    ...Array.from({ length: taller }, (_, i) => ({
      id: `t${i}`,
      expositora: false,
    })),
    ...Array.from({ length: suplentes }, (_, i) => ({
      id: ['Lorena', 'Lucila'][i] ?? `e${i}`,
      expositora: true,
    })),
  ];
}

const filas: Record<string, string | number>[] = [];
let mal = 0;

for (let taller = 28; taller <= 40; taller++) {
  const juegan = conSuplentes(sala(taller));
  const suplentes = juegan.filter((p) => p.expositora).map((p) => p.id);
  const multiplo = juegan.length % 3 === 0;
  // Con nueve o más el reparto tiene que salir sin romperse.
  let tríos = 0;
  try {
    tríos = repartoEnsayo(juegan.map((p) => p.id))[0].length;
  } catch {
    tríos = -1;
  }
  if (!multiplo) mal++;
  filas.push({
    taller,
    'sobran': taller % 3,
    'juegan': suplentes.length ? suplentes.join(' + ') : '—',
    'sala del ensayo': juegan.length,
    'múltiplo de 3': multiplo ? 'sí' : 'NO',
    'tríos': tríos,
  });
}

console.table(filas);

// La que ya tiene puesto se queda: 34 del taller reparte con las dos, y
// después llega uno y son 35, que ya cierra sin ninguna.
const antes = conSuplentes(sala(34));
const yaTienen = new Set(antes.map((p) => p.id));
const despues = conSuplentes(sala(35), yaTienen);
const sigue = despues.filter((p) => p.expositora).length;
console.log(
  `\nLlega uno tarde con el ensayo repartido: la sala pasa de ${antes.length} a ${despues.length}` +
    ` y las expositoras que ya tenían puesto siguen siendo ${sigue} de 2.`
);
if (sigue !== 2) mal++;

// Y sin nadie repartido, 35 del taller no necesita a ninguna.
const limpio = conSuplentes(sala(35)).filter((p) => p.expositora).length;
console.log(`Con 35 del taller y nada repartido, juegan ${limpio} expositoras.`);
if (limpio !== 1) mal++;

console.log(mal === 0 ? '\nTodo bien.' : `\n${mal} caso(s) mal.`);
process.exit(mal === 0 ? 0 : 1);
