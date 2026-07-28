import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarLideres } from '@/lib/supabase';
import Cuestionario from '../Cuestionario';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuestionario de Perfil — Campos HR',
  robots: { index: false, follow: false },
};

/**
 * Variante extendida: las 8 placas de perfil más las 4 de generaciones,
 * y pide el líder al que reporta la persona. De acá salen los informes.
 */
export default async function CuestionarioGeneraciones({
  params,
}: {
  params: { slug: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const lideres = await listarLideres(empresa.id);

  return (
    <Cuestionario
      slug={empresa.slug}
      empresa={empresa.nombre}
      variante="generaciones"
      lideres={lideres.map((l) => ({ id: l.id, nombre: l.nombre }))}
    />
  );
}
