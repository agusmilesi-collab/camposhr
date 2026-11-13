import { COLOR } from '@/lib/exigencia';
import type { Informe } from '@/lib/informe';
import { NOTA_COMPRENSION } from '@/lib/raven';

/**
 * Habilidad cognitiva con el Raven de 12 láminas: una tarjeta más de la grilla
 * de competencias, con la conclusión donde las otras llevan el anillo
 * (`comprensionDe` en `lib/raven.ts`). Sin número: el de 12 verifica
 * comprensión y no mide capacidad. Los aciertos los ve solo quien evalúa.
 */
const COLOR_DE = { adecuado: COLOR.Adecuado, guia: COLOR.Bajo, simples: COLOR.MuyBajo } as const;

export default function Comprension({ inf, editar }: { inf: Informe; editar?: string }) {
  if (!inf.comprension) return null;
  const [r, g, b] = COLOR_DE[inf.comprension.clave];
  const color = `rgb(${r}, ${g}, ${b})`;
  return (
    <article className="inf-competencia inf-comprension">
      <div className="inf-gauge-caja inf-comprension-sello" style={{ borderColor: color, color }}>
        <span>{inf.comprension.rotulo}</span>
      </div>
      <h3>Habilidad cognitiva</h3>
      <span className="inf-banda-texto" style={{ color }}>
        Raven de 12 láminas{editar ? ` · ${inf.comprension.aciertos} de 12` : ''}
      </span>
      <p className="inf-mide">{inf.comprension.texto}</p>
      <p className="inf-comprension-nota">{NOTA_COMPRENSION}</p>
    </article>
  );
}
