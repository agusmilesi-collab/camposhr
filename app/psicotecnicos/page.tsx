import { alcanceYPrecios } from '@/lib/precio-portal';
import { fecha } from '@/lib/hora';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Evaluaciones psicotécnicas',
  description: 'Qué incluye cada batería y cuánto sale.',
  // No se indexa: es la lista de precios y se manda a quien la pide, no se
  // publica. La dirección igual es adivinable, así que acá no va nada que no se
  // pueda decir en una reunión.
  robots: { index: false, follow: false },
};

/**
 * La lista de precios de los psicotécnicos, para mandarle a un cliente.
 *
 * Antes se contestaba por WhatsApp escribiendo los tres precios de memoria, y
 * cada tanto uno quedaba viejo. Acá sale lo que está cargado en Configuración →
 * Baterías, que es donde se editan: el mismo precio que el portal le va a
 * cobrar, sin una segunda copia que alguien tiene que acordarse de actualizar.
 *
 * **No se enlaza desde ningún lado y no se indexa.** Se dice por teléfono o se
 * pega en un mail.
 */
const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

export default async function Precios() {
  const { baterias, benzigerUsd, dolar } = await alcanceYPrecios();
  const benziger = dolar ? Math.round(benzigerUsd * dolar) : null;

  return (
    <main className="precios">
      <header className="precios-top">
        <p className="precios-marca">Campos HR</p>
        <h1>Evaluaciones psicotécnicas</h1>
        <p className="precios-bajada">
          Tres baterías según el puesto. Cada una se toma en una entrevista y se
          entrega como informe, con la recomendación de incorporación y el mapa de
          competencias de la persona.
        </p>
      </header>

      <section className="precios-lista">
        {baterias.map((b) => (
          <article className="precios-item" key={b.codigo}>
            <div className="precios-item-cabeza">
              <h2>{b.paraQuien}</h2>
              {/* El precio arriba y grande: es lo que se vino a buscar. */}
              <span className="precios-monto">
                {b.precio === null ? 'A convenir' : pesos(b.precio)}
              </span>
            </div>
            <p className="precios-cod">
              {b.codigo}
              {b.minutos ? ` · ${b.minutos} min` : ''}
              <span className="precios-por"> · por candidato</span>
            </p>
            <p className="precios-incluye">{b.queIncluye}</p>
          </article>
        ))}
      </section>

      {/* El Benziger no está en ninguna batería: lo agrega el pedido cuando el
          puesto lo pide, y se factura en dólares. */}
      <section className="precios-item precios-suma">
        <div className="precios-item-cabeza">
          <h2>Evaluación de perfil de pensamiento</h2>
          <span className="precios-monto">
            USD {benzigerUsd}
            {benziger ? <em> · {pesos(benziger)}</em> : null}
          </span>
        </div>
        <p className="precios-incluye">
          Opcional, se suma a cualquier batería. Dice cómo piensa y decide la
          persona, y cómo se la conduce. Se factura en pesos al dólar tarjeta del
          día en que se emite la factura.
        </p>
      </section>

      <footer className="precios-pie">
        <p>
          Precios de hoy, sin IVA
          {dolar ? `. Dólar tarjeta de referencia: ${pesos(dolar)}` : ''}
          {dolar ? `, al ${fecha(new Date().toISOString())}` : ''}.
        </p>
        <p>
          Los informes se entregan por el portal del cliente y por los canales
          acordados. Para pedir una evaluación, escribinos y te mandamos tu
          enlace.
        </p>
      </footer>
    </main>
  );
}
