import { notFound } from 'next/navigation';
import FiltroEmpresa from '../FiltroEmpresa';
import Shell from '../../Shell';
import Entrevistas from '../Entrevistas';
import Entregados from '../Entregados';
import Reparto from '../Reparto';
import Agregar from '../Agregar';
import { cargar, porEspera, visiblesEn } from '../datos';
import { TODAS } from '@/lib/filtro-empresa';
import { SECCIONES, SECCION_DE_RUTA } from '@/lib/psicotecnicos-tipos';

export const dynamic = 'force-dynamic';

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
      </div>

      {/* Las tres secciones son tableros y se explican solas, así que el filtro
          por cliente solo aparece si está filtrando: escondido y activo a la
          vez, deja filas afuera sin decirlo y sin nada que tocar para entender
          por qué falta alguien. */}
      {empresa !== TODAS && (
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

      {/* Las tres etapas de una entrevista, en un tablero: citar, agendar y
          analizar. Se cambia de etapa arrastrando la tarjeta. */}
      {seccion.ruta === 'entrevistas' && (
        <Entrevistas filas={filas} evaluadoras={evaluadoras} pedidos={pedidos} />
      )}

      {/* El registro de lo entregado, con el seguimiento como una columna más.
          Es la única sección que va en tabla: acá el trabajo terminó y lo que
          se hace es consultar. */}
      {seccion.ruta === 'entregados' && <Entregados filas={filas} />}

    </Shell>
  );
}
