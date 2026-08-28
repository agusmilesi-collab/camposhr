import { notFound } from 'next/navigation';
import { armarInforme } from '@/lib/informe';
import { datosClienteDeSupabase } from '@/lib/portal-supabase';
import { yaEntregada } from '@/lib/psicotecnicos-tipos';
import Documento from '@/app/os/psicotecnicos/informe/_doc/Documento';
import Descargar from './Descargar';
import { esPortalEjemplo } from '@/lib/portal-ejemplo';
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

  // Con los informes apagados para esa empresa, esta dirección no existe:
  // esconder el botón del portal y dejar el enlace abierto no sería esconder
  // nada. Se prende y se apaga desde la ficha del cliente en el OS.
  if (!datos.informesVisibles) notFound();

  // La evaluación tiene que ser de esta empresa y estar entregada.
  const suyo = datos.busquedas
    .flatMap((b) => b.candidatos)
    .some((c) => c.id === params.id && yaEntregada(c.estado));
  if (!suyo) notFound();

  const inf = await armarInforme(params.id);
  if (!inf) notFound();

  const muestra = esPortalEjemplo(params.token);

  return (
    <main className="pinf">
      {/* El aviso primero y de lado a lado, el mismo de las facturas sin CAE:
          lo que se lee abajo tiene la forma de un informe real, y hay que decir
          antes de nada que la persona no existe. Una nota al costado se saltea;
          una banda que cruza la pantalla, no. Va arriba de la barra y no debajo
          porque la barra se queda fija al desplazarse: puesto abajo, el aviso se
          iba de la pantalla en el primer movimiento. */}
      {muestra && (
        <p className="pinf-muestra">
          <span>
            <b>Informe de muestra.</b> La persona, la empresa y el puesto son
            inventados, y el protocolo se escribió para armar el ejemplo: no
            corresponde a ninguna evaluación real. Lo demás es el informe tal como se
            entrega.
          </span>
        </p>
      )}

      <header className="pinf-top">
        <a className="pinf-volver" href={`/${params.token}`}>
          ← Volver
        </a>
        <Descargar muestra={muestra} />
      </header>

      <Documento inf={inf} />
    </main>
  );
}
