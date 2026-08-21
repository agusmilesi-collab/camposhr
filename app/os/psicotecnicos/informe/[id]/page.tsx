import { notFound } from 'next/navigation';
import { armarInforme } from '@/lib/informe';
import Documento from '../_doc/Documento';
import Imprimir from './Imprimir';

export const dynamic = 'force-dynamic';

/**
 * El informe solo, para imprimir.
 *
 * Sin el marco del OS: es lo que se convierte en PDF y lo que se le entrega al
 * cliente, así que no puede llevar barra lateral ni pestañas. La misma vista
 * embebida está en la ficha, que es donde se la revisa mientras se carga.
 */
export async function generateMetadata({ params }: { params: { id: string } }) {
  const inf = await armarInforme(params.id);
  return { title: inf ? `${inf.nombre} — Informe psicotécnico` : 'Informe' };
}

export default async function InformePagina({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { descargar?: string };
}) {
  const inf = await armarInforme(params.id);
  if (!inf) notFound();
  return (
    <main className="inf-suelto">
      {searchParams.descargar === '1' && <Imprimir />}
      <Documento inf={inf} interno />
    </main>
  );
}
