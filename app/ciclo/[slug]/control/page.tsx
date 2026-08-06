import { notFound } from 'next/navigation';
import {
  claveControlOk,
  listarActividades,
  listarAsistentes,
  resolverCiclo,
} from '@/lib/ciclo';
import Control from './Control';

/**
 * El control de la expositora.
 *
 * Pide la clave en la URL (?k=…) porque los asistentes conocen la dirección del
 * ciclo: la escanearon para entrar. La expositora se guarda el enlace con la
 * clave puesta y para ella es un toque, igual que sin clave.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Control del encuentro — Campos HR',
  robots: { index: false, follow: false },
};

export default async function ControlDelCiclo({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { k?: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { empresa, corrida } = ciclo;

  const clave = searchParams?.k ?? '';
  if (!claveControlOk(corrida, clave)) notFound();

  const [actividades, asistentes] = await Promise.all([
    listarActividades(corrida.ciclo_id),
    listarAsistentes(corrida.id),
  ]);

  return (
    <Control
      slug={empresa.slug}
      empresa={empresa.nombre}
      clave={clave}
      registrados={asistentes.length}
      actividades={actividades.map((a) => ({
        id: a.id,
        clave: a.clave,
        charla: a.charla,
        tipo: a.tipo,
        titulo: a.titulo,
        abierta: corrida.actividad_abierta_id === a.id,
      }))}
    />
  );
}
