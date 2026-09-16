import 'server-only';
import { listarAsistentes, listarCiclos, listarCorridas } from '@/lib/ciclo';

/**
 * Los clientes que están recorriendo un ciclo, con lo que se mira el día del
 * encuentro.
 *
 * Vive acá y no en la pantalla porque lo usan las dos: el índice, para decir
 * para quién se dictó el ciclo, y la pantalla del ciclo, donde se abren y se
 * cierran las actividades.
 */
export type EnCurso = {
  slug: string;
  empresa: string;
  registrados: number;
  clave: string;
  abierta: boolean;
};

/**
 * Qué material corresponde a qué ciclo de la base.
 *
 * El índice de presentaciones nombra al material y la base nombra al producto,
 * y no tienen por qué escribirse igual. Los clientes no se declaran en el
 * índice: salen de las corridas activas, así dar de alta uno nuevo lo hace
 * aparecer solo.
 */
export const MATERIAL_DEL_CICLO: Record<string, string> = {
  'Liderazgos Humanos': 'Liderazgos Humanos',
};

/** Los clientes en curso de cada material, y los ciclos de la base para el alta. */
export async function encuentrosEnCurso(): Promise<{
  porMaterial: Map<string, EnCurso[]>;
  ciclosBase: { id: string; nombre: string }[];
}> {
  const [corridas, ciclosBase] = await Promise.all([listarCorridas(), listarCiclos()]);
  const porMaterial = new Map<string, EnCurso[]>();

  for (const [material, nombreCiclo] of Object.entries(MATERIAL_DEL_CICLO)) {
    const filas: EnCurso[] = [];
    for (const corrida of corridas.filter((c) => c.ciclos?.nombre === nombreCiclo)) {
      const asistentes = await listarAsistentes(corrida.id);
      filas.push({
        slug: corrida.empresas.slug,
        empresa: corrida.empresas.nombre,
        registrados: asistentes.length,
        clave: corrida.clave_control,
        abierta: Boolean(corrida.actividad_abierta_id),
      });
    }
    porMaterial.set(material, filas);
  }

  return { porMaterial, ciclosBase: ciclosBase.map((c) => ({ id: c.id, nombre: c.nombre })) };
}
