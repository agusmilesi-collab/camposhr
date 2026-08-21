import { notFound } from 'next/navigation';
import { armarInforme } from '@/lib/informe';
import { datosClienteDeSupabase } from '@/lib/portal-supabase';
import { yaEntregada } from '@/lib/psicotecnicos-tipos';
import Documento from '@/app/os/psicotecnicos/informe/_doc/Documento';
import Descargar from './Descargar';
import './portal-informe.css';

export const dynamic = 'force-dynamic';

/**
 * El informe como lo ve el cliente.
 *
 * Tres controles antes de mostrarlo: el enlace tiene que resolver a una
 * empresa, la evaluación tiene que pertenecer a un pedido de esa empresa, y
 * tiene que estar entregada. Si falla cualquiera responde 404 sin decir cuál,
 * porque decir "existe pero no es tuyo" ya es información.
 *
 * Se arma con los datos cargados, no con un archivo subido: lo que el cliente
 * ve es lo mismo que la evaluadora revisó en su ficha.
 */

export const metadata = { robots: { index: false, follow: false } };

export default async function InformeDelPortal({
  params,
}: {
  params: { token: string; id: string };
}) {
  const datos = await datosClienteDeSupabase(params.token);
  if (!datos) notFound();

  // La evaluación tiene que ser de esta empresa y estar entregada.
  const suyo = datos.busquedas
    .flatMap((b) => b.candidatos)
    .some((c) => c.id === params.id && yaEntregada(c.estado));
  if (!suyo) notFound();

  const inf = await armarInforme(params.id);
  if (!inf) notFound();

  return (
    <main className="pinf">
      <header className="pinf-top">
        <a className="pinf-volver" href={`/${params.token}`}>
          ← Volver
        </a>
        <Descargar />
      </header>
      <Documento inf={inf} />
    </main>
  );
}
