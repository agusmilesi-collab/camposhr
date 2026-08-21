import { notFound } from 'next/navigation';
import { esTestDeManchas, TESTS } from '@/lib/laminas';
import Placas from './Placas';
import './placas.css';

export const dynamic = 'force-dynamic';

/**
 * La herramienta de administración de manchas, adentro del OS.
 *
 * Fuera del marco del OS a propósito: la pantalla se comparte con la persona
 * evaluada, y la barra lateral con los nombres de los otros candidatos no
 * puede estar ahí.
 */
export function generateMetadata({ params }: { params: { test: string } }) {
  const t = esTestDeManchas(params.test) ? TESTS[params.test].nombre : 'Láminas';
  return { title: `${t} — Campos OS` };
}

export default function Laminas({ params }: { params: { test: string } }) {
  if (!esTestDeManchas(params.test)) notFound();
  return <Placas test={params.test} total={TESTS[params.test].laminas} />;
}
