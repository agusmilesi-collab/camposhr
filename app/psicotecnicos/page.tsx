import { alcanceYPrecios } from '@/lib/precio-portal';
import { bateriasConContenido } from '@/lib/baterias-detalle';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Evaluaciones psicotécnicas',
  description: 'Qué mide cada batería, qué recibe la empresa y cuánto sale.',
  // No se indexa: es la lista de precios y se manda a quien la pide, no se
  // publica. La dirección igual es adivinable, así que acá no va nada que no se
  // pueda decir en una reunión.
  robots: { index: false, follow: false },
};

/**
 * Las evaluaciones psicotécnicas, para el cliente que pregunta cuánto sale.
 *
 * Antes se contestaba por WhatsApp escribiendo los tres precios de memoria, y
 * cada tanto uno quedaba viejo. Acá sale lo que está cargado en Configuración →
 * Baterías: los mismos tests, las mismas entregas y el mismo precio que el
 * portal le va a cobrar, sin una segunda copia que alguien tiene que acordarse
 * de actualizar.
 *
 * **Es un documento de venta, no una lista de precios.** Quien la abre está
 * decidiendo si contratar, así que primero lee para qué sirve y qué recibe, y
 * el precio llega cuando ya sabe contra qué compararlo. El orden es el de la
 * conversación real: el problema, qué se hace, qué queda en la mano, cuánto
 * sale, quién lo firma.
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

/** Qué es cada test, en una línea, para quien no es psicólogo. */
const QUE_ES: Record<string, string> = {
  Rorschach:
    'Test proyectivo completo, codificado con el Sistema Comprehensivo de Exner: cómo procesa la realidad, cómo maneja la emoción y cómo se vincula.',
  Zulliger:
    'Test proyectivo abreviado, del mismo sistema que el Rorschach: la misma lectura sobre un protocolo más corto.',
  Bender: 'Prueba gráfica de organización y control: cómo planifica y sostiene una tarea.',
  'Gráfico 2 personas':
    'Prueba gráfica de vínculo: cómo se ubica frente a otro, qué lugar toma y cuál cede.',
  Raven:
    'Matrices progresivas: razonamiento lógico y capacidad de resolver situaciones nuevas, con su percentil.',
  'Entrevista por competencias':
    'Entrevista sobre situaciones concretas de trabajo: qué hizo, cómo lo decidió y con qué resultado.',
  'Análisis discursivo (Elliot Jaques)':
    'Sobre cinco minutos de discurso, en qué nivel de complejidad puede trabajar hoy y hasta dónde puede llegar.',
};

/**
 * Quiénes firman los informes.
 *
 * Escrito acá y no leído de `evaluadoras`, que solo guarda el nombre: la
 * matrícula y la formación son datos de venta y no del pipeline. Salen de las
 * bios que ya se publican en el sitio de Sentir, así que las dos páginas dicen
 * lo mismo.
 */
const EQUIPO = [
  {
    nombre: 'Lorena Campos',
    foto: '/equipo/lorena-campos.png',
    titulo: 'Lic. en Psicología · Mat. 5217',
    bio: 'Especialista en Psicología Cognitiva y Máster en Mindfulness (Universidad de Zaragoza). Desde 2009 trabaja en el ámbito organizacional, acompañando empresas locales, nacionales y multinacionales en liderazgo, gestión de personas y procesos soft.',
  },
  {
    nombre: 'Lucila Campos',
    foto: '/equipo/lucila-campos.png',
    titulo: 'Lic. en Psicología · Mat. 6338',
    bio: 'Especialista en Psicología Cognitiva y Máster en Mindfulness (Universidad de Zaragoza). Desde 2013 trabaja en clínica con adultos y trastornos de ansiedad, y combina esa experiencia con psicología organizacional y bienestar laboral en empresas.',
  },
];

/** Qué recibe la empresa, explicado. */
const QUE_LLEGA: Record<string, string> = {
  'Recomendación de incorporación':
    'El veredicto, primero: apto, apto con observaciones o no apto, con el porqué en dos líneas.',
  'Mapa de competencias':
    'Cada competencia del puesto puntuada, con lo que la sostiene y lo que la limita.',
  'Recomendaciones para su líder':
    'Cómo conducir a esa persona: qué necesita para rendir y qué la traba.',
  'Informe de potencial':
    'Hasta dónde puede crecer y en cuánto tiempo, según el modelo de Elliot Jaques.',
};

export default async function Precios() {
  const [{ baterias, benzigerUsd, dolar }, detalle] = await Promise.all([
    alcanceYPrecios(),
    bateriasConContenido(),
  ]);
  const benziger = dolar ? Math.round(benzigerUsd * dolar) : null;
  const conDetalle = baterias.map((b) => ({ ...b, ...(detalle[b.codigo] ?? { tests: [], entrega: [] }) }));

  return (
    <main className="precios">
      <header className="precios-top">
        <p className="precios-marca">Campos HR</p>
        <h1>La persona correcta en el lugar correcto</h1>
        <p className="precios-bajada">
          Medimos a cada candidato contra el perfil psicolaboral del puesto, cruzando
          una batería clínica con entrevista y observación. No decimos cómo es la
          persona en abstracto: decimos cómo le va a ir en ese puesto, con ese jefe.
        </p>
        <p className="precios-bajada">
          Se usa antes de cerrar con un finalista, o cuando hay que promover a
          alguien a un puesto de conducción. El informe abre por el veredicto y lo
          firma una psicóloga.
        </p>
      </header>

      {/* Qué queda en la mano, antes que el precio: es lo que se está
          comprando, y sin eso el número no se puede comparar contra nada. */}
      <section className="precios-bloque">
        <h2 className="precios-titulo">Qué recibe la empresa</h2>
        <ul className="precios-entrega">
          {Object.entries(QUE_LLEGA).map(([que, comoEs]) => (
            <li key={que}>
              <strong>{que}.</strong> {comoEs}
            </li>
          ))}
        </ul>
        <p className="precios-nota">
          El informe de potencial va solo en la batería ejecutiva. Todo llega por el
          portal del cliente, donde queda disponible, y también por los canales
          acordados.
        </p>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Las tres baterías</h2>
        <div className="precios-lista">
          {conDetalle.map((b) => (
            <article className="precios-item" key={b.codigo}>
              <div className="precios-item-cabeza">
                <h3>{b.paraQuien}</h3>
                <span className="precios-monto">
                  {b.precio === null ? 'A convenir' : pesos(b.precio)}
                </span>
              </div>
              <p className="precios-cod">
                {b.codigo}
                {b.minutos ? ` · ${b.minutos} min con la persona` : ''}
                <span className="precios-por"> · por candidato</span>
              </p>

              {b.tests.length > 0 && (
                <div className="precios-detalle">
                  <span className="precios-detalle-titulo">Qué se le toma</span>
                  <ul>
                    {b.tests.map((t) => (
                      <li key={t}>
                        <strong>{t}.</strong> {QUE_ES[t] ?? ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {b.entrega.length > 0 && (
                <div className="precios-detalle">
                  <span className="precios-detalle-titulo">Qué se entrega</span>
                  <ul className="precios-entrega-corta">
                    {b.entrega.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* El perfil de pensamiento no está en ninguna batería: se suma a
                  la que sea, y por eso se ofrece en las tres. */}
              <p className="precios-opcional">
                Se le puede sumar la <strong>evaluación de perfil de pensamiento</strong>{' '}
                (Benziger): USD {benzigerUsd}
                {benziger ? ` · ${pesos(benziger)}` : ''} por candidato.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">La evaluación de perfil de pensamiento</h2>
        <p className="precios-parrafo">
          Es opcional y se suma a cualquier batería. Dice cómo piensa y decide la
          persona: con qué parte del cerebro trabaja cómoda, cuál le cuesta, y qué
          le pasa cuando el puesto le exige la que no es suya. Sirve para armar
          equipos que se complementen y para saber cómo conducir a cada uno.
        </p>
        <p className="precios-nota">
          USD {benzigerUsd} por candidato
          {benziger ? `, hoy ${pesos(benziger)}` : ''}. Se factura en pesos al dólar
          tarjeta del día en que se emite la factura.
        </p>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Cómo es el proceso</h2>
        <ol className="precios-pasos">
          <li>
            <strong>Nos mandás el pedido.</strong> Desde tu portal: el puesto, los CV y
            nada más. De cada CV salen solos el nombre, el teléfono y el correo.
          </li>
          <li>
            <strong>Citamos y evaluamos.</strong> Coordinamos con cada candidato,
            presencial o por videollamada, y tomamos la batería completa en una sola
            entrevista.
          </li>
          <li>
            <strong>Recibís el informe.</strong> Queda en tu portal, con el veredicto
            arriba y el detalle abajo. Ahí ves en qué anda cada candidato mientras
            tanto, sin tener que preguntar.
          </li>
        </ol>
      </section>

      {/* Quiénes firman, con nombre, matrícula y cara. En una decisión así lo
          que se compra es el criterio de quien firma, y un informe sin autor
          identificable vale menos que uno con matrícula al pie. */}
      <section className="precios-bloque">
        <h2 className="precios-titulo">Quiénes firman</h2>
        <div className="precios-equipo">
          {EQUIPO.map((p) => (
            <article className="precios-persona" key={p.nombre}>
              <img
                className="precios-foto"
                src={p.foto}
                alt={`Foto de ${p.nombre}`}
                width={150}
                height={150}
                loading="lazy"
              />
              <div>
                <h3 className="precios-persona-nombre">{p.nombre}</h3>
                <p className="precios-persona-titulo">{p.titulo}</p>
                <p className="precios-persona-bio">{p.bio}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="precios-nota">
          Cada informe lleva la firma de quien tomó la entrevista: la misma persona
          que estuvo con el candidato es la que responde por lo que dice.
        </p>
      </section>

      <footer className="precios-pie">
        <p className="precios-cierre">
          Para empezar, escribinos y te abrimos tu portal: desde ahí pedís las
          evaluaciones y recibís los informes.
        </p>
        <p>
          Precios de hoy, sin IVA
          {dolar ? `. Dólar tarjeta de referencia: ${pesos(dolar)}` : ''}.
        </p>
      </footer>
    </main>
  );
}
