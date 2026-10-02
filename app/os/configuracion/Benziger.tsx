import Cuadrantes from './Cuadrantes';
import { ajuste } from '@/lib/ajustes';
import { INFO, PERFILES } from '@/lib/perfiles';
import {
  TEXTOS_BENZIGER,
  benzigerQueRige,
  benzigerValidos,
  type TextosDeCuadrante,
} from '@/lib/benziger-textos';

/**
 * Los textos del Benziger, editables.
 *
 * Por cuadrante, lo que el informe dice de la persona cuando ese es su
 * cuadrante predominante, y las siete pautas para conducirla que van al plan de
 * incorporación. Cada texto trae su fuente al lado: todo sale del material
 * oficial de Benziger, y quien lo corrija tiene que poder ver de dónde vino.
 *
 * **Se guarda la diferencia y no los cuatro**, igual que los estratos del
 * potencial: lo que quedó igual al código no se guarda, así una corrección que
 * entre por el código llega a quien no tocó nada.
 */
export default async function Benziger() {
  const guardados = await ajuste<Record<string, Partial<TextosDeCuadrante>>>('benziger_cuadrantes');
  const movidos = benzigerValidos(guardados) ?? {};

  const cuadrantes = PERFILES.map((p) => ({
    clave: p,
    nombre: INFO[p].nombre,
    textos: benzigerQueRige(p, movidos),
    original: TEXTOS_BENZIGER[p].textos,
    fuentes: TEXTOS_BENZIGER[p].fuentes,
  }));

  return <Cuadrantes cuadrantes={cuadrantes} tocado={Object.keys(movidos).length > 0} />;
}
