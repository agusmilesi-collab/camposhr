import { notFound } from 'next/navigation';
import FiltroEmpresa from '../FiltroEmpresa';
import Shell from '../../Shell';
import TablaEtapa from '../Tabla';
import Reparto from '../Reparto';
import { cargar, porEspera, visiblesEn } from '../datos';
import { ETAPA_DE_RUTA, RUTA } from '@/lib/psicotecnicos';

export const dynamic = 'force-dynamic';

/**
 * Qué se hace en cada etapa, en una línea, arriba de la lista. El reparto no
 * figura acá: sus columnas dicen lo mismo sin escribirlo.
 */
const QUE_SE_HACE: Record<string, string> = {
  Entregado: 'Lo que ya salió, con su conclusión y su fecha.',
  Seguimiento: 'Personas contratadas a las que se les hace seguimiento.',
};

/**
 * Pantallas que van sin bajada ni filtro por cliente.
 *
 * Se explican solas: la lista dice lo que hay que hacer y el filtro estorba
 * más de lo que ordena cuando se está trabajando la propia cola.
 */
const DESNUDAS = new Set(['Sin asignar', 'Por citar', 'Por entrevistar', 'Por analizar']);

export function generateStaticParams() {
  return Object.values(RUTA).map((etapa) => ({ etapa }));
}

export default async function EtapaPagina({ params }: { params: { etapa: string } }) {
  const etapa = ETAPA_DE_RUTA[params.etapa];
  if (!etapa) notFound();

  const { todas, yo, cuentas, fallaron, empresas, empresa, ocultas, evaluadoras } =
    await cargar();
  const filas = porEspera(visiblesEn(todas, etapa, yo));

  // El reparto necesita las dos mitades: lo que no tiene dueño y lo que ya está
  // repartido, porque la carga de cada evaluadora es la mitad de la decisión.
  const esReparto = etapa === 'Sin asignar';
  const desnuda = DESNUDAS.has(etapa);
  const asignadas = esReparto ? todas.filter((f) => f.evaluadora) : [];

  return (
    <Shell
      titulo={`Psicotécnicos · ${etapa}`}
      nota={filas.length === 1 ? '1 persona' : `${filas.length} personas`}
      identidad={yo.nombre}
      ancho
      avisos={[`/os/psicotecnicos/${RUTA['Sin asignar']}`]}
      cuentas={Object.fromEntries(
        cuentas.map((c) => [`/os/psicotecnicos/${c.ruta}`, c.n])
      )}
    >
      <div className="os-encabezado">
        <h1>{etapa}</h1>
        {!desnuda && <p>{QUE_SE_HACE[etapa]}</p>}
      </div>

      {!desnuda && (
        <FiltroEmpresa empresas={empresas} actual={empresa} ocultas={ocultas} />
      )}

      {fallaron.length > 0 && (
        <div className="os-aviso">
          No se pudo leer {fallaron.join(' ni ')}. Falta lo que vive de ese lado.
        </div>
      )}

      {esReparto ? (
        <Reparto sinAsignar={filas} asignadas={asignadas} evaluadoras={evaluadoras} />
      ) : (
        <section className="os-panel">
          {filas.length === 0 ? (
            <p className="os-vacio">
              {yo.alcance === 'todo'
                ? 'No hay nadie en esta etapa.'
                : `${yo.nombre} no tiene nada en esta etapa.`}
            </p>
          ) : (
            <TablaEtapa filas={filas} etapa={etapa} />
          )}
        </section>
      )}
    </Shell>
  );
}
