import { parrafoBenziger, type Informe } from '@/lib/informe';

/**
 * Lo que el informe dice del Benziger debajo del cuadrante predominante: su
 * mayor fortaleza, su mayor debilidad y el entorno en el que rinde
 * (`lib/benziger-contexto.ts`).
 *
 * Es uno solo para el documento clásico y para el informe en hojas: cambia
 * únicamente la clase del rótulo, que cada uno trae de su hoja de estilos.
 *
 * Los rótulos no nombran el cuadrante: el cliente no necesita saber que la
 * debilidad es el frontal derecho, necesita saber qué tareas le cuestan. El
 * puntaje tampoco va en el texto; quien firma lo ve en la etiqueta de origen.
 */
export default function BenzigerLecturas({
  inf,
  editar,
  rotulo,
}: {
  inf: Informe;
  editar?: string;
  /** La clase del subtítulo de cada bloque. */
  rotulo: string;
}) {
  const bz = inf.benziger;
  if (!bz) return null;

  const modos = [
    ['fortaleza', 'Mayor fortaleza', bz.fortaleza],
    ['debilidad', 'Mayor debilidad', bz.debilidad],
  ] as const;

  /* Lo reescrito para esta persona pisa lo calculado, y entonces la etiqueta
     ya no puede citar la página: dice que lo escribió quien firma. */
  const origen = (k: 'fortaleza' | 'debilidad' | 'entorno', calculado: string) =>
    editar ? (
      <span className="inf-respaldo inf-origen">{bz.editado[k] ? 'Benziger · reescrito' : calculado}</span>
    ) : null;

  return (
    <>
      {modos.map(([k, titulo, m]) =>
        m ? (
          <div key={k} className="inf-bloque">
            <h3 className={rotulo}>{titulo}</h3>
            <p>
              {parrafoBenziger(bz, k)}
              {origen(
                k,
                `Benziger ${m.clave}${m.puntaje !== null ? ` ${m.puntaje} de 140, ${m.banda}` : ''} · ${m.fuente}`
              )}
            </p>
          </div>
        ) : null
      )}

      {/* El mismo trabajo en un ritmo que no es el suyo rinde menos. */}
      {bz.entorno && (
        <div className="inf-bloque">
          <h3 className={rotulo}>Entorno en el que rinde</h3>
          <p>
            {parrafoBenziger(bz, 'entorno')}
            {origen('entorno', `Benziger extraversión ${bz.entorno.nivel} · ${bz.entorno.fuente}`)}
          </p>
        </div>
      )}
    </>
  );
}
