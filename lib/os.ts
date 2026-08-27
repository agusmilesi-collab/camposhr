/**
 * El nombre de una empresa, reducido a una clave comparable.
 *
 * Lo que había acá era el panorama de la home, armado con un pedido a Airtable
 * por cliente. Airtable dejó de escribirse con la migración del 25/8/2026, así
 * que ese panel mostraba la etapa que cada evaluación tenía ese día: la home lo
 * lee de la base del sistema desde entonces, y esto quedó como lo único que
 * seguía en uso.
 */

import 'server-only';

/**
 * Existe porque la misma empresa se escribe distinto en cada fuente: Airtable
 * la tiene como "Laruso" y el índice de cotizaciones como "Laruso SRL". Saca
 * tildes, puntos y la forma societaria, que es lo que suele diferir.
 */
export function claveEmpresa(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(srl|sa|sas|sac|sh|scs|ltda|inc|s de rl)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
