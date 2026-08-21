import { notFound } from 'next/navigation';
import FiltroEmpresa from '../FiltroEmpresa';
import Shell from '../../Shell';
import TablaEtapa from '../Tabla';
import PorAnalizar from '../PorAnalizar';
import Reparto from '../Reparto';
import Agregar from '../Agregar';
import { cargar, porEspera, visiblesEn } from '../datos';
import { SECCIONES, SECCION_DE_RUTA, type Evaluacion } from '@/lib/psicotecnicos-tipos';

export const dynamic = 'force-dynamic';

/**
 * Qué se hace en cada etapa, en una línea, arriba de la lista. El reparto no
 * figura acá: sus columnas dicen lo mismo sin escribirlo.
 */
const QUE_SE_HACE: Record<string, string> = {
  entregados: 'Lo que ya salió, con su conclusión y su fecha.',
};

/**
 * Pantallas que van sin bajada ni filtro por cliente.
 *
 * Se explican solas: la lista dice lo que hay que hacer y el filtro estorba
 * más de lo que ordena cuando se está trabajando la propia cola.
 */
const DESNUDAS = new Set([
  'sin-asignar',
  'entrevistas',
  'por-analizar',
  'entregados',
  // Seguimiento va separado por empresa, y una tabla por cliente hace lo que
  // hacía el filtro sin obligar a elegir de a uno: la llamada de seguimiento se
  // prepara mirando todo lo de esa empresa junto.
  'seguimiento',
]);

/**
 * Las evaluaciones agrupadas por empresa, cada grupo con las suyas en el orden
 * en que venían. Las empresas salen ordenadas alfabéticamente, que es como se
 * las busca cuando hay varias.
 */
function porEmpresa(filas: Evaluacion[]): [string, Evaluacion[]][] {
  const grupos = new Map<string, Evaluacion[]>();
  for (const f of filas) {
    const nombre = f.empresa || 'Sin empresa';
    const suyas = grupos.get(nombre);
    if (suyas) suyas.push(f);
    else grupos.set(nombre, [f]);
  }
  return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

export function generateStaticParams() {
  return SECCIONES.map((s) => ({ etapa: s.ruta }));
}

export default async function EtapaPagina({ params }: { params: { etapa: string } }) {
  const seccion = SECCION_DE_RUTA[params.etapa];
  if (!seccion) notFound();

  const {
    todas,
    yo,
    cuentas,
    fallaron,
    empresas,
    empresa,
    ocultas,
    evaluadoras,
    pedidos,
    evaluadorasAlta,
    empresasAlta,
    bateriasAlta,
  } = await cargar();
  const filas = porEspera(visiblesEn(todas, seccion, yo));

  // El reparto necesita las dos mitades: lo que no tiene dueño y lo que ya está
  // repartido, porque la carga de cada evaluadora es la mitad de la decisión.
  const esReparto = seccion.ruta === 'sin-asignar';
  // Seguimiento parte en dos: los que entraron, que es lo que se llama a los
  // noventa días, y los que todavía no se sabe, que es la llamada anterior.
  const entraron = filas.filter((f) => f.ingreso === true);
  const porPreguntar = filas.filter((f) => f.ingreso !== true);
  const desnuda = DESNUDAS.has(seccion.ruta);
  const asignadas = esReparto ? todas.filter((f) => f.evaluadora) : [];

  return (
    <Shell
      titulo={`Psicotécnicos · ${seccion.texto}`}
      nota={filas.length === 1 ? '1 persona' : `${filas.length} personas`}
      identidad={yo.nombre}
      ancho
      avisos={['/os/psicotecnicos/sin-asignar']}
      cuentas={Object.fromEntries(
        cuentas.map((c) => [`/os/psicotecnicos/${c.ruta}`, c.n])
      )}
    >
      <div className="os-encabezado">
        <h1>{seccion.texto}</h1>
        {!desnuda && <p>{QUE_SE_HACE[seccion.ruta]}</p>}
      </div>

      {!desnuda && (
        <FiltroEmpresa empresas={empresas} actual={empresa} ocultas={ocultas} />
      )}

      {fallaron.length > 0 && (
        <div className="os-aviso">
          No se pudo leer {fallaron.join(' ni ')}. Falta lo que vive de ese lado.
        </div>
      )}

      {esReparto && (
        <Reparto
          sinAsignar={filas}
          asignadas={asignadas}
          evaluadoras={evaluadoras}
          pedidos={pedidos}
          alta={
            <Agregar
              pedidos={pedidos}
              empresas={empresasAlta}
              baterias={bateriasAlta}
              evaluadoras={evaluadorasAlta}
            />
          }
        />
      )}

      {/* Entrevistas va en dos bloques: primero a quién hay que llamar, después
          lo que ya tiene fecha. Son dos trabajos distintos del mismo día y en
          una sola lista se mezclaban. */}
      {seccion.ruta === 'entrevistas' &&
        [
          { etapa: 'Por citar', titulo: 'Por citar', vacio: 'No hay nadie esperando que lo citen.' },
          { etapa: 'Por entrevistar', titulo: 'Agendadas', vacio: 'No hay entrevistas agendadas.' },
        ].map((b) => {
          const suyas = filas.filter((f) => f.etapa === b.etapa);
          return (
            <section className="os-panel os-bloque-entrevistas" key={b.etapa}>
              <div className="os-panel-top">
                <h2>{b.titulo}</h2>
                <span className="os-columna-monto">
                  {suyas.length === 1 ? '1 persona' : `${suyas.length} personas`}
                </span>
              </div>
              {suyas.length === 0 ? (
                <p className="os-vacio">{b.vacio}</p>
              ) : (
                <TablaEtapa filas={suyas} seccion={seccion.ruta} />
              )}
            </section>
          );
        })}

      {/* Por analizar va en tarjetas: en esa etapa el trabajo es entrar a cada
          persona a leer lo suyo, no recorrer una lista de filas. */}
      {seccion.ruta === 'por-analizar' &&
        (filas.length === 0 ? (
          <section className="os-panel">
            <p className="os-vacio">
              {yo.alcance === 'todo'
                ? 'No hay nadie esperando análisis.'
                : `${yo.nombre} no tiene nada para analizar.`}
            </p>
          </section>
        ) : (
          <PorAnalizar filas={filas} />
        ))}

      {/* Seguimiento, una tabla por empresa. A los noventa días de que alguien
          entró se llama al cliente, y esa llamada es por empresa y no por
          persona: en una sola lista había que ir salteando filas de otras.

          Arriba, solo los que entraron a trabajar, que son los únicos que
          tienen seguimiento que hacer; por eso ninguna tabla trae columna de
          ingreso. Los que todavía no se sabe van al final y no se esconden: es
          la otra llamada pendiente, y una evaluación que no aparece en ninguna
          pantalla está perdida. */}
      {seccion.ruta === 'seguimiento' && (
        <>
          {entraron.length === 0 && porPreguntar.length === 0 && (
            <section className="os-panel">
              <p className="os-vacio">No hay nadie esperando seguimiento.</p>
            </section>
          )}

          {porEmpresa(entraron).map(([nombre, suyas]) => (
            <section className="os-panel os-bloque-entrevistas" key={nombre}>
              <div className="os-panel-top">
                <h2>{nombre}</h2>
                <span className="os-columna-monto">
                  {suyas.length === 1 ? '1 persona' : `${suyas.length} personas`}
                </span>
              </div>
              <TablaEtapa filas={suyas} seccion={seccion.ruta} />
            </section>
          ))}

          {porPreguntar.length > 0 && (
            <section className="os-panel os-bloque-entrevistas">
              <div className="os-panel-top">
                <h2>Sin saber si entró</h2>
                <span className="os-columna-monto">
                  {porPreguntar.length === 1 ? '1 persona' : `${porPreguntar.length} personas`}
                </span>
              </div>
              <p className="os-nota-bloque">
                Hay que preguntarle a la empresa si la persona entró. Se carga en su ficha, y
                recién ahí arranca la cuenta de los noventa días.
              </p>
              <TablaEtapa filas={porPreguntar} seccion={seccion.ruta} />
            </section>
          )}
        </>
      )}

      {!esReparto &&
        seccion.ruta !== 'entrevistas' &&
        seccion.ruta !== 'por-analizar' &&
        seccion.ruta !== 'seguimiento' && (
        <section className="os-panel">
          {filas.length === 0 ? (
            <p className="os-vacio">
              {yo.alcance === 'todo'
                ? 'No hay nadie en esta etapa.'
                : `${yo.nombre} no tiene nada en esta etapa.`}
            </p>
          ) : (
            <TablaEtapa filas={filas} seccion={seccion.ruta} />
          )}
        </section>
      )}
    </Shell>
  );
}
