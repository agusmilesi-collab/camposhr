/**
 * Verifica el reparto del ensayo de la charla 4 para salas de distinto tamaño.
 *
 *   node --experimental-strip-types scripts/verificar-ensayo.ts
 *
 * Comprueba las cuatro condiciones que tiene que cumplir a la vez: que nadie
 * quede afuera ni aparezca dos veces en la misma ronda, que cada persona pase
 * por los tres roles, por los tres casos y por las tres reacciones, y que nadie
 * repita compañero.
 */
import { repartoEnsayo, ROLES } from '../lib/ensayo.ts';

type Fila = {
  personas: number;
  tríos: number;
  sobran: number;
  'parejas repetidas': number;
  'con los 3 roles': string;
  'con los 3 casos': string;
  'con las 3 reacciones': string;
};

function verificar(n: number): Fila {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const rondas = repartoEnsayo(ids);
  if (rondas.length !== 3) throw new Error('tienen que ser tres rondas');

  const parejas = new Map<string, number>();
  const roles = new Map<string, Set<string>>();
  const casos = new Map<string, Set<number>>();
  const reacciones = new Map<string, Set<number>>();

  rondas.forEach((grupos, r) => {
    const vistos = new Set<string>();
    for (const g of grupos) {
      const enGrupo = g.puestos.map((p) => p.asistenteId);
      if (new Set(enGrupo).size !== enGrupo.length) {
        throw new Error(`ronda ${r}: alguien dos veces en el grupo ${g.grupo}`);
      }
      if (enGrupo.length < 3) {
        throw new Error(`ronda ${r}: el grupo ${g.grupo} no llega a tres`);
      }
      if (!g.puestos.some((p) => p.rol === 'comunica')) {
        throw new Error(`ronda ${r}: el grupo ${g.grupo} no tiene quien comunique`);
      }
      for (const { asistenteId, rol } of g.puestos) {
        if (vistos.has(asistenteId)) {
          throw new Error(`ronda ${r}: ${asistenteId} está en dos grupos`);
        }
        vistos.add(asistenteId);
        if (!ROLES.includes(rol)) throw new Error(`rol desconocido: ${rol}`);
        (roles.get(asistenteId) ?? roles.set(asistenteId, new Set()).get(asistenteId)!).add(rol);
        (casos.get(asistenteId) ?? casos.set(asistenteId, new Set()).get(asistenteId)!).add(g.caso);
        (
          reacciones.get(asistenteId) ??
          reacciones.set(asistenteId, new Set()).get(asistenteId)!
        ).add(g.reaccion);
      }
      for (let i = 0; i < enGrupo.length; i++) {
        for (let j = i + 1; j < enGrupo.length; j++) {
          const par = [enGrupo[i], enGrupo[j]].sort().join('·');
          parejas.set(par, (parejas.get(par) ?? 0) + 1);
        }
      }
    }
    if (vistos.size !== n) throw new Error(`ronda ${r}: quedaron ${n - vistos.size} afuera`);
  });

  const conTres = (m: Map<string, Set<unknown>>) =>
    ids.filter((id) => (m.get(id)?.size ?? 0) === 3).length;

  return {
    personas: n,
    tríos: Math.floor(n / 3),
    sobran: n % 3,
    'parejas repetidas': [...parejas.values()].filter((v) => v > 1).length,
    'con los 3 roles': `${conTres(roles)}/${n}`,
    'con los 3 casos': `${conTres(casos)}/${n}`,
    'con las 3 reacciones': `${conTres(reacciones)}/${n}`,
  };
}

const filas: Fila[] = [];
for (let n = 9; n <= 45; n++) filas.push(verificar(n));
console.table(filas);

const perfectas = filas.filter((f) => f.sobran === 0);
const fallan = perfectas.filter(
  (f) =>
    f['parejas repetidas'] > 0 ||
    f['con los 3 roles'] !== `${f.personas}/${f.personas}` ||
    f['con los 3 casos'] !== `${f.personas}/${f.personas}` ||
    f['con las 3 reacciones'] !== `${f.personas}/${f.personas}`
);
if (fallan.length) {
  console.error('FALLAN con cantidad múltiplo de tres:', fallan);
  process.exit(1);
}
console.log(
  `\nOK: ${perfectas.length} tamaños múltiplos de tres, ` +
    'sin parejas repetidas y con los tres roles, casos y reacciones para todos.'
);
