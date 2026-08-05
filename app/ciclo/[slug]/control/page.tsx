import { notFound } from 'next/navigation';
import { getEmpresaPorSlug } from '@/lib/supabase';
import { claveControlOk, listarActividades, listarAsistentes } from '@/lib/ciclo';
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
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const clave = searchParams?.k ?? '';
  if (!claveControlOk(clave)) notFound();

  const [actividades, asistentes] = await Promise.all([
    listarActividades(empresa.id),
    listarAsistentes(empresa.id),
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
        abierta: a.abierta,
      }))}
    />
  );
}
