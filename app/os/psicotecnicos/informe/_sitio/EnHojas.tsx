import type { Informe } from '@/lib/informe';
import OnePager from '@/app/os/psicotecnicos/ficha/[id]/OnePager';
import Cabecera from './Cabecera';
import { seccionesDe } from './secciones';

/**
 * El informe como se ve en la pestaña Informe de la ficha: todo en hoja A4, con
 * la letra y el aire del papel. La primera es una carilla de alto fijo; el
 * resto va en una hoja del mismo ancho que crece con el contenido.
 *
 * Es uno solo para la pestaña y para la descarga. Hasta el 2/10/2026 la
 * descarga imprimía el documento de siempre (`_doc/Documento.tsx`), que tiene
 * otra forma: la evaluadora revisaba una cosa y el cliente recibía otra.
 *
 * `editar` solo llega desde la ficha. Sin él no salen los botones de editar ni
 * las etiquetas de origen, que son de quien firma.
 *
 * `descarga` saca los indicadores: la tabla de datos es para revisar en la
 * ficha y no va en lo que se le entrega al cliente.
 */
export default function EnHojas({
  inf,
  editar,
  descarga,
}: {
  inf: Informe;
  editar?: string;
  descarga?: boolean;
}) {
  const [primera, ...resto] = seccionesDe(inf, editar).filter((s) => !(descarga && s.id === 'datos'));
  return (
    <div className="sitio sitio-secciones-ficha">
      {/* La primera hoja, el one pager, como carilla A4: los datos y las
          conclusiones hasta la confidencialidad. Lo que sigue va seguido
          debajo, sin carillas. */}
      {primera && (
        <OnePager>
          <Cabecera inf={inf} />
          <section className="sitio-seccion">
            <header className="sitio-seccion-top">
              <span className="sitio-numero">01</span>
              <div>
                <h2>{primera.titulo}</h2>
                {primera.bajada && <p>{primera.bajada}</p>}
              </div>
            </header>
            <div className="sitio-caja">{primera.cuerpo}</div>
          </section>
        </OnePager>
      )}
      {/* El resto, en la misma hoja: el mismo ancho, la misma letra y el mismo
          aire que la primera. No tiene alto fijo porque su largo depende de la
          persona; al imprimir, cada capítulo arranca en hoja nueva. */}
      {resto.length > 0 && (
        <div className="os-onepager">
          <div className="os-onepager-hoja os-onepager-resto">
            {resto.map((s, i) => (
              <section key={s.id} className="sitio-seccion">
                <header className="sitio-seccion-top">
                  <span className="sitio-numero">{String(i + 2).padStart(2, '0')}</span>
                  <div>
                    <h2>{s.titulo}</h2>
                    {s.bajada && <p>{s.bajada}</p>}
                  </div>
                </header>
                <div className="sitio-caja">{s.cuerpo}</div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
