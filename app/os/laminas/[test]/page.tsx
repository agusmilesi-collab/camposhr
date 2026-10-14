import { notFound } from 'next/navigation';
import { esTestConLaminas, TESTS } from '@/lib/laminas';
import Placas from './Placas';
import './placas.css';

export const dynamic = 'force-dynamic';

/**
 * La herramienta de administración de láminas, adentro del OS.
 *
 * Fuera del marco del OS a propósito: la pantalla se comparte con la persona
 * evaluada, y la barra lateral con los nombres de los otros candidatos no
 * puede estar ahí.
 */
export async function generateMetadata(props: { params: Promise<{ test: string }> }) {
  const params = await props.params;
  const t = esTestConLaminas(params.test) ? TESTS[params.test].nombre : 'Láminas';
  return { title: `${t} — Campos OS` };
}

export default async function Laminas(props: { params: Promise<{ test: string }> }) {
  const params = await props.params;
  if (!esTestConLaminas(params.test)) notFound();
  return <Placas test={params.test} total={TESTS[params.test].laminas} />;
}
