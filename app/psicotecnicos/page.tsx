import { alcanceYPrecios } from '@/lib/precio-portal';
import { bateriasConContenido } from '@/lib/baterias-detalle';
import { tiempoDeEntrega } from '@/lib/tiempo-entrega';
import { Equipo, IconoWhatsapp, Pestanas, pesos } from './piezas';
import { IgualarTarjetas } from './IgualarTarjetas';
import { Servicio } from './Servicio';
import { COACHING, DEVOLUCION, ENTREVISTAS } from './servicios';

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

/**
 * El color de cada batería.
 *
 * Uno por número y siempre el mismo: la pastilla es lo que ata la tarjeta con
 * su columna de la tabla comparativa, y con las tres del mismo color hay que
 * leer el número cada vez. Va por el dígito del código y no por posición, así
 * el día que se agregue una cuarta no se corren los colores de las otras tres.
 */
function colorDe(codigo: string): string {
  const n = codigo.match(/\d/)?.[0] ?? '1';
  return `precios-pill-${n}`;
}

/**
 * Cuándo conviene cada una, para el que está comparando.
 *
 * Las tres dicen a quién apuntan (`para_quien`, que se edita en Configuración),
 * y esto dice qué se evalúa en ese perfil. Los textos son los del tarifario de
 * las psicólogas (agosto 2026), que clasifican por el criterio con el que eligen
 * la batería: si la persona tiene gente a cargo, si el puesto es clave o si se
 * mide el potencial. Viven acá y no en la base porque no los usa el pipeline.
 */
const CUANDO: Record<string, string> = {
  'Batería 1':
    'Evalúa cómo va a desempeñarse la persona en su rol individual, con sus fortalezas y los aspectos a desarrollar. Aporta recomendaciones para su líder y claridad sobre el ajuste al puesto.',
  'Batería 2':
    'Profundiza el análisis de la personalidad para evaluar capacidades de gestión, en un perfil clave para la organización por los procesos o los equipos que tiene a su cargo.',
  'Batería 3':
    'Analiza el alcance potencial de la persona para asumir roles de mayor responsabilidad: la proyección futura del perfil y hasta dónde puede desarrollarse.',
};

/**
 * Qué recibe la empresa, en el orden de la decisión: el veredicto, el porqué y
 * cómo conducirlo si entra. Una línea cada uno; el detalle está en el informe
 * de ejemplo del portal.
 */
const QUE_LLEGA: { que: string; comoEs: string }[] = [
  { que: 'Recomendación de incorporación', comoEs: 'apto, apto con observaciones o no apto.' },
  { que: 'Mapa de competencias', comoEs: 'cada competencia del puesto, puntuada.' },
  { que: 'Recomendaciones para su líder', comoEs: 'cómo conducirlo desde el primer día.' },
  { que: 'Informe de potencial', comoEs: 'hasta dónde puede crecer (solo en la Batería 3).' },
];

/** Los cuatro cuadrantes del Benziger, en el orden en que se dibujan: frontales arriba. */
const CUADRANTES = [
  { nombre: 'Frontal izquierdo', rasgos: 'Análisis, decisiones, metas y dirección.' },
  { nombre: 'Frontal derecho', rasgos: 'Creatividad, innovación, solución de problemas y riesgo.' },
  { nombre: 'Basal izquierdo', rasgos: 'Organización, productividad, monitoreo y control.' },
  { nombre: 'Basal derecho', rasgos: 'Buena voluntad, armonía, liderazgo natural y empatía.' },
];

/**
 * Cómo se nombra un test en la página, cuando no es como se guarda.
 *
 * Los nombres son los del tarifario de las psicólogas: "Gráfico 2 personas" es
 * como se lo llama adentro, y quien contrata reconoce "test proyectivo gráfico".
 *
 * En Configuración el análisis discursivo lleva el autor del modelo, que es lo
 * que necesita quien codifica. Quien contrata no sabe quién es, y un apellido
 * entre paréntesis en el nombre del test se lee como un requisito más.
 */
const ROTULO: Record<string, string> = {
  Zulliger: 'Test de Zulliger',
  Rorschach: 'Test de Rorschach',
  Bender: 'Test visomotor de Bender',
  'Gráfico 2 personas': 'Test proyectivo gráfico',
  Raven: 'Test de lógica Raven serie II',
  'Análisis discursivo (Elliot Jaques)': 'Análisis del discurso',
};

/**
 * Tres pestañas: psicotécnicos, coaching, y entrevistas y referencias. La de
 * psicotécnicos es la de siempre y abre por defecto, así que la dirección que
 * ya circula sigue mostrando lo mismo.
 */
export default async function Precios({
  searchParams,
}: {
  searchParams?: { servicio?: string };
}) {
  const servicio =
    searchParams?.servicio === 'coaching'
      ? COACHING
      : searchParams?.servicio === 'entrevistas'
        ? ENTREVISTAS
        : null;
  const activa =
    servicio === COACHING ? 'coaching' : servicio === ENTREVISTAS ? 'entrevistas' : 'psicotecnicos';

  const [{ baterias, benzigerUsd, dolar }, detalle, plazo] = await Promise.all([
    alcanceYPrecios(),
    bateriasConContenido(),
    tiempoDeEntrega(),
  ]);
  const benziger = dolar ? Math.round(benzigerUsd * dolar) : null;
  const conDetalle = baterias.map((b) => ({ ...b, ...(detalle[b.codigo] ?? { tests: [], entrega: [] }) }));

  return (
    <>
    <main className="precios">
      <header className="precios-top">
        {/* El logotipo tipográfico del sitio: Instrument Serif, el nombre con
            su punto. Es el mismo de camposhr.com, así que quien llega desde un
            mail reconoce dónde está parado. */}
        {/* El mismo encabezado del informe: el logotipo con la bajada debajo, en
            versalitas, y el sitio a la derecha. Quien pide precios y quien
            recibe el informe tienen que reconocer el mismo papel. */}
        <p className="precios-marca">
          <span className="precios-marca-nombre">
            Campos HR
            <span>{servicio ? servicio.bajadaMarca : 'Evaluaciones psicotécnicas'}</span>
          </span>
          {/* El sitio arriba y a la derecha: es donde se lo busca cuando la
              página llega reenviada y ya no se sabe de dónde salió. */}
          <a className="precios-sitio" href="https://www.camposhr.com">
            www.camposhr.com
          </a>
        </p>
        <Pestanas activa={activa} />
      </header>

      {servicio ? (
        <Servicio datos={servicio} />
      ) : (
      <>

      <section className="precios-bloque">
        {/* Más chico: nombra lo que sigue, que son las tres tarjetas, y cada
            una abre con su propio título grande. */}
        <h2 className="precios-titulo precios-titulo-menor">Evaluaciones psicotécnicas</h2>
        <div className="precios-lista">
          <IgualarTarjetas />
          {conDetalle.map((b) => (
            <article className="precios-item" key={b.codigo}>
              {/* Desplegable: cerrada muestra el código, el precio, para quién
                  es y cuándo conviene, que es con lo que se elige entre las
                  tres. El alcance y la entrega se abren sobre la elegida. */}
              <details className="precios-desplegable">
              <summary className="precios-plegada">
              {/* El código, la duración y el precio en el mismo renglón de
                  arriba: son los tres datos con los que se compara una batería
                  contra otra, y el precio es el que más se busca. Abajo del
                  título quedaba a la altura de otra cosa en cada tarjeta,
                  porque los títulos miden distinto. */}
              <p className="precios-pill-fila">
                <span className={`precios-pill ${colorDe(b.codigo)}`}>{b.codigo}</span>
                {b.minutos ? (
                  <span className="precios-cod">{b.minutos} min con la persona</span>
                ) : null}
                <span className="precios-monto">
                  {b.precio === null ? 'A convenir' : pesos(b.precio)}
                  <em>por candidato</em>
                </span>
              </p>

              {/* Lo que va entre paréntesis baja al renglón de abajo: es la
                  aclaración del perfil y no parte del nombre. */}
              <h3 className="precios-item-titulo">
                {b.paraQuien.split(/\s(?=\()/).map((parte, i) => (
                  <span key={parte}>
                    {i > 0 && <br />}
                    {parte}
                  </span>
                ))}
              </h3>

              {/* Para quién es y cuándo conviene: es lo que decide entre una y
                  otra, y sin esto había que deducirlo de la lista de tests. */}
              {CUANDO[b.codigo] && (
                <p className="precios-cuando">{CUANDO[b.codigo]}</p>
              )}
                {/* A la vista con la tarjeta cerrada: el perfil de pensamiento
                    se recomienda en las tres y es lo primero que se ofrece
                    sumar. El detalle está en su sección, debajo de las tarjetas. */}
                <span className="precios-benziger-tira">
                  <span className="precios-benziger-tira-rotulo">Recomendado</span>
                  Sumale el perfil de pensamiento Benziger · USD {benzigerUsd}
                </span>
                <span className="precios-ver" aria-hidden="true">
                  <span className="precios-ver-abrir">Ver detalle</span>
                  <span className="precios-ver-cerrar">Ocultar detalle</span>
                </span>
              </summary>

              {/* Lo que se mide y lo que llega, uno debajo del otro y a todo el
                  ancho. En dos columnas cada renglón entraba en cuatro líneas
                  de tres palabras. Los tests van numerados: el número dice
                  cuántos son, que es la mitad de lo que separa una batería de
                  otra. */}
              <div className="precios-item-detalles">
                {b.tests.length > 0 && (
                  <div className="precios-detalle">
                    <span className="precios-detalle-titulo">Alcance</span>
                    <ol className="precios-medidas">
                      {b.tests.map((t, i) => (
                        <li key={t}>
                          <span className="precios-num">{i + 1}</span>
                          <span>{ROTULO[t] ?? t}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Lo que el tarifario incluye en el precio además de los
                    tests. El detalle del informe está en Entregables. */}
                <div className="precios-detalle precios-detalle-entrega">
                  <span className="precios-detalle-titulo">Incluye</span>
                  <p>
                    Informe con conclusiones y recomendaciones, y acompañamiento a RH o
                    al jefe directo sobre el informe y el perfil evaluado.
                  </p>
                </div>
              </div>

              {/* El perfil de pensamiento no está en ninguna batería: se suma a
                  la que sea, así que se ofrece en las tres con lo que aporta y
                  su precio, y no en una sección aparte que hay que ir a buscar
                  para entender de qué se trata.

                  En la 2 y la 3 va como recomendado y no como opcional: en un
                  puesto donde la persona decide o conduce, cómo piensa cambia
                  con quién se la combina y cómo se la conduce, y eso se pide en
                  casi todos esos pedidos. */}
              <div className="precios-opcional">
                <span className="precios-detalle-titulo">Opcional</span>
                <p>
                  <strong className="precios-opcional-nombre">
                    Devolución a la persona evaluada.
                  </strong>{' '}
                  La psicóloga le devuelve a la persona los resultados de su evaluación.
                </p>
                <p className="precios-opcional-precio">
                  {pesos(DEVOLUCION)} por persona, a cargo de la empresa o del consultante.
                </p>
              </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      {/* El perfil de pensamiento, con sección propia y a la vista: se
          recomienda en las tres baterías y es lo que más conviene sumar. Los
          cuatro cuadrantes van en la posición que tienen en el modelo (frontal
          arriba, basal abajo), con los textos del tarifario de las psicólogas. */}
      <section className="precios-bloque" id="benziger">
        <div className="precios-benziger">
          <span className="precios-benziger-rotulo">Recomendado en las tres baterías</span>
          <h2 className="precios-benziger-titulo">Perfil de pensamiento Benziger</h2>
          <p>
            Detecta el perfil natural de la persona según su preferencia de
            pensamiento: el cuadrante cerebral con el que trabaja de manera más
            eficiente. <strong>Con eso puede desarrollarse en su puesto de forma más
            fluida y natural, sin agotarse y evitando el burn out.</strong>
          </p>
          <div className="precios-cuadrantes">
            {CUADRANTES.map((c) => (
              <div className="precios-cuadrante" key={c.nombre}>
                <span className="precios-cuadrante-rotulo">Cuadrante</span>
                <strong>{c.nombre}</strong>
                <span>{c.rasgos}</span>
              </div>
            ))}
          </div>
          <p className="precios-benziger-precio">
            <strong>USD {benzigerUsd} por candidato</strong>, a sumar a cualquier
            batería. Se factura en pesos al dólar tarjeta del día de facturación
            {benziger ? `: al de hoy son ${pesos(benziger)}` : ''}.
          </p>
          <p className="precios-benziger-licencia">
            Contamos con la licencia oficial de la plataforma internacional Benziger.
          </p>
        </div>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Entregables</h2>
        <p className="precios-parrafo">
          Un informe por candidato, firmado por la psicóloga que lo entrevistó:
        </p>
        <ul className="precios-entrega">
          {QUE_LLEGA.map((x, i) => (
            <li key={x.que}>
              <span className="precios-num">{'ABCDEFG'[i]}</span>
              <span>
                <strong>{x.que}:</strong> {x.comoEs}
              </span>
            </li>
          ))}
        </ul>
        <p className="precios-parrafo precios-entrega-despues">
          Incluye el acompañamiento a RH o al jefe directo en la lectura del informe.
        </p>
      </section>

      {/* Entre lo que se entrega y cómo se pide: quien acaba de leer qué llega
          escrito quiere ver cómo lo va a ver, y el paso siguiente es el portal.
          Va a la empresa de prueba, con candidatos inventados. */}
      <section className="precios-bloque">
        {/* Próximamente: el portal de ejemplo todavía no está listo para
            mostrarse, así que el botón queda a la vista pero sin enlace. */}
        <div className="precios-demo precios-demo-pronto" aria-disabled="true">
          {/* Una ventana con sus renglones: dice de un vistazo que del otro lado
              hay una pantalla con la lista de candidatos, y no un documento. */}
          <span className="precios-demo-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <rect
                x="2.5"
                y="4"
                width="19"
                height="16"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path d="M2.5 8.5h19" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="5.6" cy="6.2" r="0.7" fill="currentColor" />
              <path
                d="M6 12h6M6 15.5h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="17.5" cy="12" r="1.3" fill="currentColor" />
            </svg>
          </span>
          <span className="precios-demo-texto">
            <strong>Ver portal e informe de ejemplo</strong>
          </span>
          <span className="precios-demo-pronto-rotulo">Próximamente</span>
        </div>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Cómo es el proceso</h2>
        {/* En un párrafo: pedido, coordinación y entrega. El plazo es el
            promedio que mide el sistema sobre las entregas ya hechas; si
            todavía no hay casos suficientes, queda la promesa escrita. */}
        <p className="precios-parrafo">
          Nos mandás el pedido desde tu portal de cliente, con el puesto y los CV, y
          nosotras coordinamos la entrevista con cada candidato, presencial o por
          videollamada.{' '}
          {plazo
            ? `Te mandamos el informe dentro de los ${plazo.dias.toLocaleString('es-AR')} días de entrevistado (es nuestro plazo promedio), y también queda disponible en tu portal.`
            : 'En menos de cinco días desde la entrevista te mandamos el informe, que también queda disponible en tu portal.'}
        </p>
        <p className="precios-parrafo">
          Para empezar, escribinos un WhatsApp al{' '}
          <a className="precios-wa" href="https://wa.me/5493416402533">
            <IconoWhatsapp />
            +54 9 341 640 2533
          </a>
          .
        </p>
        {/* Las condiciones comerciales, todas juntas: qué comprobante llega y
            cómo se paga son las dos preguntas que hace administración antes de
            aprobar, y no estaban escritas en ningún lado. */}
        <p className="precios-nota">
          Precios de hoy, sin IVA
          {dolar ? `. Dólar tarjeta de referencia: ${pesos(dolar)}` : ''}. Se entrega
          factura C y se abona por transferencia.
        </p>
      </section>

      <Equipo
        titulo="Evaluadoras"
        nota="Cada informe lleva la firma de quien tomó la entrevista: la misma persona que estuvo con el candidato es la que responde por lo que dice."
      />
      </>
      )}

      {/* Lo demás que hace el estudio y el pie, en una banda blanca de ancho
          completo.

          Fuera del cuerpo del documento a propósito: quien abre esta página vino
          por un psicotécnico, y esto es lo que se lleva sin haberlo buscado. El
          cambio de fondo dice que el documento terminó, y adentro el texto sigue
          alineado con el resto porque la banda lleva su propia caja del mismo
          ancho. */}
    </main>

    <footer className="precios-final">
      <div className="precios-final-caja">
      <section className="precios-bloque">
        {/* El nombre con la tipografía del logotipo, la misma del encabezado:
            acá se está firmando el resto de lo que hace el estudio. */}
        {/* Más chico que los otros títulos de sección: lo que cierra el
            documento no puede pesar como lo que se vino a leer. */}
        <h2 className="precios-titulo precios-titulo-menor">
          Otros servicios de <span className="precios-firma">Campos HR</span>
        </h2>
        {/* Los tres servicios del catálogo que no son esta página, con la misma
            forma que el titular: qué problema resuelve, cómo se hace y cuándo se
            usa. Sin la primera oración, cada uno abría por el método y quien lee
            tenía que deducir para qué le serviría.

            Cuatro oraciones cada uno, contando la de cuándo se usa. Es el largo
            que entra de un vistazo al final de un documento que se leyó entero,
            y obliga a decir el método en vez de enumerar temas; el detalle de
            cada línea está en su propia presentación.

            Lo que necesita muchas evaluaciones para decir algo no está acá: con
            la base de hoy, un patrón por área o por nivel se apoyaría en un
            puñado de casos. */}
        <ul className="precios-otros">
          <li>
            <strong>Diseño organizacional.</strong> Ordenamos quién decide qué y
            qué se espera de cada puesto, cuando la estructura dejó de ser evidente.
            Derivamos de la cadena de valor las capacidades críticas y el organigrama
            objetivo, y cierra en un plan de hasta ocho decisiones, con responsable y
            costo de postergarlas.
            <span className="precios-cuando-sirve">
              Se usa cuando la empresa creció y sigue conducida como al principio, o
              cuando hay una sucesión o una venta a la vista.
            </span>
          </li>
          <li>
            <strong>Formación de líderes y mandos medios.</strong> Damos herramientas
            de conducción a quien llegó al puesto por su oficio técnico. Relevamos
            cómo se conduce hoy y armamos un programa vivencial sobre los casos del
            propio equipo: delegación, devolución de desempeño, decisiones difíciles
            y conflictos.
            <span className="precios-cuando-sirve">
              Se usa cuando alguien técnicamente muy competente conduce gente por
              primera vez, o cuando las conversaciones difíciles se postergan hasta
              que el problema llega a dirección.
            </span>
          </li>
          {/* El logo arriba y no al costado: acá se está diciendo bajo qué marca
              se dicta, y esa firma encabeza el servicio en vez de acompañarlo. */}
          <li>
            <span className="precios-otro-marca">
              <img
                className="precios-logo-sentir"
                src="/marcas/sentir.svg"
                alt="Sentir Mindfulness"
                width={92}
                height={46}
                loading="lazy"
              />
              <span className="precios-otro-firma">Campos HR by Sentir Mindfulness</span>
            </span>
            <strong>Talleres de habilidades humanas.</strong> Bajamos el desgaste de
            un equipo que trabaja a presión, sin sacarlo una semana de su puesto.
            Módulos de 40 o 90 minutos en la empresa: mindfulness para el estrés,
            conversaciones difíciles, el HR Help Kit para Recursos Humanos y
            entrevista por competencias.
            <span className="precios-cuando-sirve">
              Se usa cuando el equipo trabaja a presión permanente, o cuando Recursos
              Humanos absorbe los conflictos de todos los sectores.
            </span>
          </li>
        </ul>
      </section>

      {/* El pie: quién firma la página, dónde queda y cómo se llega al sitio.
          La tripleta es la de la marca, en castellano: el documento entero está
          en castellano y un lema en inglés en el pie se lee como de otra
          empresa. */}
      <div className="precios-pie">
        <p className="precios-pie-marca">Campos HR</p>
        <p className="precios-pie-lema">
          Estructura inteligente. Potencial humano. Impacto medible.
        </p>
        <p className="precios-pie-datos">
          {/* El WhatsApp con su logotipo: es por donde escribe la mayoría, y el
              ícono dice a dónde lleva sin agregar una palabra. */}
          <a className="precios-wa" href="https://wa.me/5493416402533">
            <IconoWhatsapp />
            +54 9 341 640 2533
          </a>
          <span>·</span>
          Rosario, Argentina
          <span>·</span>
          <a href="https://www.camposhr.com">www.camposhr.com</a>
        </p>
      </div>
      </div>
    </footer>
    </>
  );
}
