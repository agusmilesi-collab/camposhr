/**
 * Verifica la transcripción de la Tabla A del Rorschach.
 *
 *   node --experimental-strip-types scripts/verificar-tabla-a.ts
 *
 * La tabla se copia a mano de un librito de cuatro columnas por página, y el
 * error que se comete es siempre el mismo: una lista sigue arriba de la columna
 * siguiente y esas entradas terminan pegadas al área equivocada. Pasó dos veces
 * al cargar la lámina I (D3 quedó adentro de D2, y tres entradas de Dd28
 * adentro de DdS26), y las dos las encontró este chequeo.
 *
 * Lo que se comprueba:
 *
 *   · Que cada renglón se pueda leer (calidad formal, posición, respuesta).
 *   · Que no haya respuestas repetidas dentro de un área.
 *   · Que cada área esté en orden alfabético, que es como la imprime el libro.
 *     Comparando sin tildes y sin puntuación, porque el libro ordena así.
 *
 * Una entrada fuera de orden casi siempre significa que está en el área
 * equivocada. Antes de mover nada hay que mirar la foto de esa página: el
 * libro agrupa por concepto en algún caso suelto, y ahí el desorden es del
 * libro y no de la transcripción.
 */
import { LAMINAS, leerRenglon, type Entrada } from '../lib/rorschach-tabla-a.ts';

/** Como ordena el libro: sin tildes, sin puntuación, sin mayúsculas. */
function clave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '');
}

/** Las excepciones del libro: dónde el desorden está impreso y es correcto. */
const AGRUPADAS_POR_CONCEPTO = new Set([
  // D2 pone las orejas pequeñas antes que las grandes: son la misma entrada
  // partida en dos, y el libro las deja juntas en ese orden.
  'I·D2·animal específico con orejas pequeñas, tal como gato, vaca, algunas razas de perros',
]);

let mal = 0;
const resumen: Record<string, number>[] = [];

for (const [lamina, datos] of Object.entries(LAMINAS)) {
  for (const [area, renglones] of Object.entries(datos.areas)) {
    const entradas: Entrada[] = [];
    for (const r of renglones) {
      try {
        entradas.push(leerRenglon(r));
      } catch (e) {
        console.error(`✗ ${lamina} ${area}: ${(e as Error).message}`);
        mal++;
      }
    }

    const vistas = new Set<string>();
    for (const e of entradas) {
      if (vistas.has(e.respuesta)) {
        console.error(`✗ ${lamina} ${area}: "${e.respuesta}" está dos veces`);
        mal++;
      }
      vistas.add(e.respuesta);
    }

    const puestas = entradas.map((e) => e.respuesta);
    const ordenadas = [...puestas].sort((a, b) => clave(a).localeCompare(clave(b), 'es'));
    for (let i = 0; i < puestas.length; i++) {
      if (clave(puestas[i]) === clave(ordenadas[i])) continue;
      if (AGRUPADAS_POR_CONCEPTO.has(`${lamina}·${area}·${puestas[i]}`)) break;
      console.error(
        `✗ ${lamina} ${area}: "${puestas[i]}" está fuera de orden, ahí va "${ordenadas[i]}".\n` +
          `  Probablemente pertenece a otra área: mirá la foto de esa página.`
      );
      mal++;
      break;
    }

    resumen.push({ [`${lamina} ${area}`]: entradas.length });
  }
}

const total = resumen.reduce((s, r) => s + Object.values(r)[0], 0);
console.table(Object.assign({}, ...resumen));
console.log(`\n${total} entradas en ${resumen.length} áreas.`);
console.log(mal === 0 ? '✓ Sin problemas.' : `✗ ${mal} problema(s).`);
process.exit(mal === 0 ? 0 : 1);
