import { notFound } from 'next/navigation';
import { getEmpresaPorSlug } from '@/lib/supabase';
import Cuestionario from './Cuestionario';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuestionario de Perfil — Campos HR',
  robots: { index: false, follow: false },
};

export default async function CuestionarioPublico(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  return <Cuestionario slug={empresa.slug} empresa={empresa.nombre} />;
}
