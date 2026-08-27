import { notFound } from 'next/navigation';
import FiltroEmpresa from '../FiltroEmpresa';
import Shell from '../../Shell';
import Entrevistas from '../Entrevistas';
import Entregados from '../Entregados';
import Agregar from '../Agregar';
import { cargar, porEspera, visiblesEn } from '../datos';
import { TODAS } from '@/lib/filtro-empresa';
import { hoy } from '@/lib/hora';
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
    carga,
    evaluadoras,
    pedidos,
    evaluadorasAlta,
    empresasAlta,
    bateriasAlta,
  } = await cargar();
  const filas = porEspera(visiblesEn(todas, seccion, yo));

  return (
    <Shell
      titulo={`Psicotécnicos · ${seccion.texto}`}
      nota={filas.length === 1 ? '1 persona' : `${filas.length} personas`}
      identidad={yo.nombre}
      ancho
      cuentas={cuentas}
    >
      <div className="os-encabezado">
        <h1>{seccion.texto}</h1>
      </div>

      {/* Las dos secciones son tableros y se explican solas, así que el filtro
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

      {/* El circuito de una entrevista en un tablero: repartir, citar, agendar y
          analizar. La etapa se cambia arrastrando la tarjeta; de la primera
          columna se sale eligiendo a quién dársela. */}
      {seccion.ruta === 'entrevistas' && (
        <Entrevistas
          filas={filas}
          hoy={hoy()}
          evaluadoras={evaluadoras}
          carga={carga}
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

      {/* El registro de lo entregado, con el seguimiento como una columna más.
          Es la única sección que va en tabla: acá el trabajo terminó y lo que
          se hace es consultar. */}
      {seccion.ruta === 'entregados' && <Entregados filas={filas} />}

    </Shell>
  );
}
