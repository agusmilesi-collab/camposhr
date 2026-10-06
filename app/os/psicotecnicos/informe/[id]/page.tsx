import { notFound } from 'next/navigation';
import { armarInforme } from '@/lib/informe';
import Documento from '../_doc/Documento';
import Imprimir from './Imprimir';
import EnHojas from '../_sitio/EnHojas';
import { informeEnHojas } from '@/lib/empresa-prueba';
import '../_sitio/sitio.css';

export const dynamic = 'force-dynamic';

/**
 * El informe solo, para imprimir.
 *
 * Sin el marco del OS: es lo que se convierte en PDF y lo que se le entrega al
 * cliente, así que no puede llevar barra lateral ni pestañas. La misma vista
 * embebida está en la ficha, que es donde se la revisa mientras se carga.
 *
 * **En la empresa de prueba se baja con la forma de la pestaña Informe**
 * (`EnHojas`): la primera hoja como carilla y el resto seguido. Es el mismo
 * interruptor que la pestaña, así que lo que se revisa es lo que se baja. Los
 * demás clientes siguen bajando el documento de siempre.
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
      {informeEnHojas(inf.empresa) ? <EnHojas inf={inf} descarga /> : <Documento inf={inf} interno />}
    </main>
  );
}
