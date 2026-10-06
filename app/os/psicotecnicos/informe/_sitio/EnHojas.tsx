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
 *
 * `porHojas` es para el portal: el cliente lee el informe partido en hojas,
 * una por capítulo, que es como lo va a recibir si lo baja.
 */
export default function EnHojas({
  inf,
  editar,
  descarga,
  porHojas = false,
}: {
  inf: Informe;
  editar?: string;
  descarga?: boolean;
  /** Cada capítulo en su propia hoja en pantalla, como sale impreso. */
  porHojas?: boolean;
}) {
  /* Fuera de la ficha, una sección que no tiene nada para quien lee no sale:
     quedaba el título con la hoja en blanco debajo. */
  const [primera, ...resto] = seccionesDe(inf, editar).filter(
    (s) => !(descarga && s.id === 'datos') && !(s.vacia && !editar)
  );

  /* En qué hojas va el resto. En la ficha, todo en una sola hoja larga, que es
     cómoda para revisar y corregir de corrido. Con `porHojas`, cada capítulo
     en la suya, como sale impreso; las técnicas usadas no abren hoja y van
     debajo del capítulo anterior, igual que en el PDF. Tampoco abre hoja una
     sección de un renglón, ni la que le sigue: juntas llenan una. */
  const numeradas = resto.map((s, i) => ({ s, n: i + 2 }));
  const grupos: (typeof numeradas)[] = [];
  for (const item of numeradas) {
    const anterior = grupos[grupos.length - 1]?.slice(-1)[0];
    const sigueDeCorrido = item.s.id === 'tecnicas' || item.s.corta || anterior?.s.corta;
    const abreHoja = grupos.length === 0 || (porHojas && !sigueDeCorrido);
    if (abreHoja) grupos.push([item]);
    else grupos[grupos.length - 1].push(item);
  }
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
      {grupos.length > 0 && (
        <div className={`os-onepager${porHojas ? ' os-onepager-por-hojas' : ''}`}>
          {grupos.map((grupo) => (
            <div key={grupo[0].s.id} className="os-onepager-hoja os-onepager-resto">
              {grupo.map(({ s, n }) => (
                <section
                  key={s.id}
                  className="sitio-seccion"
                  data-seccion={s.id}
                  data-corta={s.corta ? '' : undefined}
                >
                  <header className="sitio-seccion-top">
                    <span className="sitio-numero">{String(n).padStart(2, '0')}</span>
                    <div>
                      <h2>{s.titulo}</h2>
                      {s.bajada && <p>{s.bajada}</p>}
                    </div>
                  </header>
                  <div className="sitio-caja">{s.cuerpo}</div>
                </section>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
