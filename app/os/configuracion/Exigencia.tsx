import Exigencias from './Exigencias';
import { exigenciasGuardadas } from '@/lib/exigencias-datos';
import { DE_FABRICA } from '@/lib/exigencia';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * La exigencia del sistema: dónde corta cada banda del puntaje.
 *
 * El puntaje de una competencia sale del protocolo y no se toca desde acá. Lo
 * que se decide es a partir de qué número se lo llama Adecuado, Alto o
 * Sobresaliente, que es una decisión del puesto: el mismo 62 puede alcanzar
 * para un rol operativo y quedarse corto para una gerencia.
 *
 * Se cuenta cuántos pedidos y cuántos candidatos usa cada perfil, porque es lo
 * que hay que mirar antes de mover un corte: mover el de un perfil que están
 * usando diez pedidos cambia cómo se leen esos diez.
 */
export default async function Exigencia() {
  const guardadas = await exigenciasGuardadas();

  const cuantos = async (tabla: string) => {
    try {
      const filas = await select<{ exigencia_id: string | null }>(
        tabla,
        'select=exigencia_id&exigencia_id=not.is.null',
        CACHE_PSICOTECNICOS
      );
      const n = new Map<string, number>();
      for (const f of filas) {
        if (f.exigencia_id) n.set(f.exigencia_id, (n.get(f.exigencia_id) ?? 0) + 1);
      }
      return n;
    } catch {
      return new Map<string, number>();
    }
  };

  const [pedidos, candidatos] = await Promise.all([cuantos('pedidos'), cuantos('evaluaciones')]);

  return (
    <Exigencias
      exigencias={(guardadas.length > 0 ? guardadas : [DE_FABRICA]).map((e) => ({
        ...e,
        pedidos: pedidos.get(e.id) ?? 0,
        candidatos: candidatos.get(e.id) ?? 0,
      }))}
      hayTabla={guardadas.length > 0}
    />
  );
}
