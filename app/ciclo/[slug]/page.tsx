import { notFound } from 'next/navigation';
import { firmarSelfies } from '@/lib/supabase';
import { listarAsistentes, resolverCiclo } from '@/lib/ciclo';
import Asistente, { type Cara } from './Asistente';

/**
 * La pantalla del asistente: el destino del código QR del encuentro.
 *
 * Un solo código para todo el grupo. La identidad la resuelve el registro, no
 * el código: treinta códigos distintos solo agregan formas de que alguien
 * escanee el del compañero.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Encuentro — Campos HR',
  robots: { index: false, follow: false },
};

export default async function CicloAsistente({
  params,
}: {
  params: { slug: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { empresa, corrida } = ciclo;

  const asistentes = await listarAsistentes(corrida.id);
  const fotos = await firmarSelfies(
    asistentes.map((a) => a.foto_path).filter((p): p is string => Boolean(p))
  );

  const caras: Cara[] = asistentes.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    apellido: a.apellido,
    foto: a.foto_path ? fotos.get(a.foto_path) ?? null : null,
  }));

  return <Asistente slug={empresa.slug} empresa={empresa.nombre} caras={caras} />;
}
