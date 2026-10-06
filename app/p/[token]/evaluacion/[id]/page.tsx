import { notFound } from 'next/navigation';
import { armarInforme } from '@/lib/informe';
import { datosClienteDeSupabase } from '@/lib/portal-supabase';
import { yaEntregada } from '@/lib/psicotecnicos-tipos';
import Documento from '@/app/os/psicotecnicos/informe/_doc/Documento';
import EnHojas from '@/app/os/psicotecnicos/informe/_sitio/EnHojas';
import BarraHojas from './BarraHojas';
import Partes from './Partes';
import { Encabezado, Marca, Pie } from '@/app/os/psicotecnicos/informe/_doc/Marco';
import { informeEnHojas } from '@/lib/empresa-prueba';
import { esPortalEjemplo } from '@/lib/portal-ejemplo';
/* La hoja A4 del informe (`os-onepager-*`) está definida en la hoja de estilos
   del OS. Va primero, como en el OS, porque varias de sus reglas esperan que
   las del informe vengan después. */
import '@/app/os/os.css';
import '@/app/os/psicotecnicos/informe/_sitio/sitio.css';
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

  /*
   * El informe en hojas corre por ahora solo en la empresa de prueba.
   *
   * Es lo mismo que la evaluadora ve en la pestaña Informe de su ficha y lo
   * mismo que se descarga desde el OS: una primera carilla con las
   * conclusiones y el resto seguido debajo. Hasta el 6/10/2026 acá iba otra
   * forma del mismo informe, con índice al costado (`Sitio.tsx`), y lo que el
   * cliente leía no era lo que se había revisado.
   *
   * Es un molde nuevo y se está afinando con Distribuidora Andina, que es la
   * empresa inventada para eso. Los clientes de verdad siguen con el informe
   * que ya conocen, en tres pestañas, hasta que el molde se dé por bueno: un
   * informe que cambia de forma entre dos candidatos de la misma búsqueda es
   * un informe que hay que volver a explicar.
   */
  /* El informe de muestra, el que se le enseña a quien pregunta por los
     precios, sigue con las tres pestañas: lleva una banda que avisa que la
     persona es inventada, y falta resolver cómo sale esa banda en el PDF del
     informe en hojas. */
  const comoSitio = !muestra && informeEnHojas(datos.empresa);

  return (
    <main className="sitio-pagina">
      {/* El aviso primero y de lado a lado, el mismo de las facturas sin CAE:
          lo que se lee abajo tiene la forma de un informe real, y hay que decir
          antes de nada que la persona no existe. Una nota al costado se saltea;
          una banda que cruza la pantalla, no. Va arriba de la barra y no debajo
          porque la barra se queda fija al desplazarse: puesto abajo, el aviso se
          iba de la pantalla en el primer movimiento. */}
      {muestra && (
        <p className="sitio-muestra">
          <span>
            <b>Informe de muestra.</b> La persona, la empresa y el puesto son
            inventados, y el protocolo se escribió para armar el ejemplo: no
            corresponde a ninguna evaluación real. Lo demás es el informe tal como se
            entrega.
          </span>
        </p>
      )}

      {/* Las tres partes se dibujan acá, del lado del servidor, y el
          componente de cliente decide cuál se ve y cuáles se imprimen: son el
          mismo informe partido en tres profundidades, y no hay nada que ir a
          buscar al cambiar de pestaña. */}
      {comoSitio ? (
        /* Un `.sitio` alrededor de todo: de ahí salen los colores de la
           barra, y la barra se queda pegada arriba mientras se recorre el
           informe porque su caja es la del informe entero. */
        <div className="sitio pinf-portal">
          <BarraHojas volver={`/${params.token}`} />
          {/* El mismo componente de la pestaña Informe de la ficha y de la
              descarga del OS, sin los indicadores ni los controles de quien
              firma. */}
          <div className="pinf-hojas">
            <EnHojas inf={inf} descarga porHojas />
          </div>
        </div>
      ) : (
        <Partes
          volver={`/${params.token}`}
          muestra={muestra}
          cabecera={
            <>
              <Marca />
              <Encabezado inf={inf} />
            </>
          }
          pie={<Pie />}
          recomendacion={<Documento inf={inf} parte="recomendacion" marco={false} />}
          fundamentos={<Documento inf={inf} parte="fundamentos" marco={false} />}
          indicadores={<Documento inf={inf} parte="indicadores" marco={false} />}
        />
      )}
    </main>
  );
}
