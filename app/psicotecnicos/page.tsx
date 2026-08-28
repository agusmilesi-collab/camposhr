import { alcanceYPrecios } from '@/lib/precio-portal';
import { bateriasConContenido } from '@/lib/baterias-detalle';
import { tiempoDeEntrega } from '@/lib/tiempo-entrega';
import { TOKEN_PORTAL_EJEMPLO } from '@/lib/portal-ejemplo';

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

/**
 * Qué dimensión de la persona aporta cada test.
 *
 * No qué es el test: qué se sabe de alguien después de tomarlo. El nombre queda
 * como etiqueta, para quien lo reconoce, y lo que se lee es la dimensión. La
 * descripción técnica no le sirve a quien contrata: le sirve saber que después
 * de esta hora y media va a saber si la persona sostiene la presión.
 */
const QUE_ES: Record<string, string> = {
  Rorschach:
    'Cómo procesa lo que le pasa, qué hace con la emoción cuando la situación aprieta y qué espera de los demás. Diez láminas de manchas: es la lectura más profunda y la que sostiene al resto del informe.',
  Zulliger:
    'Cómo procesa lo que le pasa, cómo maneja la emoción cuando la situación aprieta y qué espera de los demás. Tres láminas de manchas, con el detalle que da una versión corta.',
  Bender: 'Si organiza el trabajo y lo sostiene hasta el final, o si empieza y se dispersa.',
  'Gráfico 2 personas':
    'Qué lugar toma frente a otro: si empuja, si acompaña o si se corre, y cuánto necesita del otro para funcionar.',
  Raven: 'Cuánto tarda en entender algo que nunca vio, con su percentil contra la población.',
  'Entrevista por competencias':
    'Qué hizo en situaciones parecidas a las del puesto, con el caso contado por él: qué decidió, qué resultado tuvo y qué haría distinto.',
  'Análisis discursivo (Elliot Jaques)':
    'Qué tan complejo es el problema que puede manejar hoy, y hasta dónde va a poder llegar.',
};

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
 * pero eso no alcanza para elegir: lo que decide es qué se juega en el puesto.
 * Estos textos son de venta y viven acá, no en la base, porque no los usa el
 * pipeline.
 */
const CUANDO: Record<string, string> = {
  'Batería 1':
    'Cuando lo que se necesita saber es si la persona va a sostener la tarea: si organiza, si tolera la presión y cómo se lleva con el equipo. Con el test de manchas en su versión corta, de tres láminas, alcanza para leer cómo organiza, cuánta presión aguanta y cómo se vincula.',
  'Batería 2':
    'Cuando el puesto exige criterio propio y la decisión es más cara de errar. Se toma el test de manchas completo, de diez láminas: la persona da muchas más respuestas, y con ese material se puede afirmar cómo maneja la emoción bajo presión y qué hace cuando la situación se le complica.',
  'Batería 3':
    'Cuando la persona va a conducir a otros o a tomar decisiones que comprometen al negocio. Suma un análisis del potencial de proyección de la persona: qué nivel de complejidad puede manejar hoy, hasta dónde puede llegar y en cuánto tiempo. Es la diferencia entre elegir para el puesto de hoy y elegir para los próximos años.',
};

/**
 * Lo que cambia de una batería a otra.
 *
 * Solo eso: el Bender, el gráfico, el Raven y la entrevista están en las tres,
 * y una fila con tres tildes iguales no ayuda a elegir, que es para lo que se
 * mira una tabla comparativa.
 */
type Bateria = { codigo: string; tests: string[]; entrega: string[] };

type Fila = {
  que: string;
  en: (b: Bateria) => boolean;
  valor?: (b: Bateria) => string;
};

const DIFERENCIAS: Fila[] = [
  {
    que: 'Test de manchas',
    en: () => true,
    // Con las láminas al lado: el nombre del test solo no le dice nada a quien
    // compara, y la diferencia entre las dos filas es justamente cuánto material
    // deja el protocolo.
    valor: (b) => (b.tests.includes('Rorschach') ? 'Rorschach · 10 láminas' : 'Zulliger · 3 láminas'),
  },
  {
    que: 'Análisis discursivo',
    en: (b) => b.tests.some((t) => t.startsWith('Análisis discursivo')),
  },
  {
    que: 'Informe de potencial',
    en: (b) => b.entrega.includes('Informe de potencial'),
  },
];

/**
 * Quiénes firman los informes.
 *
 * Escrito acá y no leído de `evaluadoras`, que solo guarda el nombre: la
 * matrícula y la formación son datos de venta y no del pipeline. Salen de las
 * bios que ya se publican en el sitio de Sentir, sin la parte de mindfulness:
 * acá se está contratando un psicotécnico, y la formación que lo sostiene es la
 * clínica y la organizacional.
 */
const EQUIPO = [
  {
    nombre: 'Lorena Campos',
    foto: '/equipo/lorena-campos.png',
    titulo: 'Lic. en Psicología · Mat. 5217',
    linkedin: 'https://www.linkedin.com/in/lorecamposhr/',
    bio: 'Especialista en Psicología Cognitiva. Desde 2009 trabaja en el ámbito organizacional, acompañando empresas locales, nacionales y multinacionales en liderazgo, gestión de personas y procesos soft.',
  },
  {
    nombre: 'Lucila Campos',
    foto: '/equipo/lucila-campos.png',
    titulo: 'Lic. en Psicología · Mat. 6338',
    linkedin: 'https://www.linkedin.com/in/lulicamposhr/',
    bio: 'Especialista en Psicología Cognitiva. Desde 2013 trabaja en clínica con adultos y trastornos de ansiedad, y combina esa experiencia con psicología organizacional en empresas.',
  },
];

/**
 * Qué recibe la empresa, en el orden de la decisión.
 *
 * Primero el veredicto (contrato o no), después el porqué, y al final el
 * después: cómo conducirlo si entra. En una lista suelta, "recomendaciones para
 * su líder" pasa como un ítem más, y es lo que nadie más entrega.
 */
const QUE_LLEGA: { que: string; cuando: string; comoEs: string }[] = [
  {
    que: 'Recomendación de incorporación',
    cuando: 'La decisión',
    comoEs:
      'El veredicto, primero y firmado: apto, apto con observaciones o no apto, con los motivos que lo sostienen y las condiciones bajo las que se dice.',
  },
  {
    que: 'Mapa de competencias',
    cuando: 'El porqué',
    comoEs:
      'Cada competencia del puesto puntuada, con lo que la sostiene y lo que la limita. Es lo que se lleva a la reunión donde hay que defender la decisión.',
  },
  {
    que: 'Recomendaciones para su líder',
    cuando: 'El después',
    comoEs:
      'Si entra: qué necesita para rendir, qué la traba y cómo conducirla. Sirve desde el primer día y no se termina con la contratación.',
  },
  {
    que: 'Informe de potencial',
    cuando: 'Solo en la Batería 3',
    comoEs:
      'Hasta dónde puede crecer y en cuánto tiempo. Para cuando la persona va a ocupar puestos más grandes que el que se está cubriendo hoy.',
  },
];

/**
 * Lo que llega escrito, contado como se lee y no como una lista de secciones.
 *
 * Los nombres de las secciones ("Mapa de competencias") le dicen algo a quien
 * ya trabaja con psicotécnicos y nada a quien está decidiendo si comprarlo: lo
 * que se compra es lo que se va a entender de la persona al leerlo. Se arma
 * desde la misma lista que se edita en Configuración, así una batería a la que
 * se le saca una sección deja de prometerla.
 */
const ENTIENDE: Record<string, string> = {
  'Recomendación de incorporación':
    'la recomendación firmada sobre esta persona en este puesto (apta, apta con observaciones o no apta) con los motivos que la sostienen',
  'Mapa de competencias':
    'cada competencia del puesto puntuada, con lo que la sostiene y lo que la limita',
  'Recomendaciones para su líder':
    'qué necesita para rendir, qué la traba y cómo conducirla desde el primer día',
  'Informe de potencial':
    'hasta dónde puede crecer y en cuánto tiempo va a estar en condiciones de dar ese paso',
};

/** Cuántos capítulos, en palabras: un número en cifra al abrir se lee como precio. */
const CUANTOS = ['', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'];



/**
 * Cómo se nombra un test en la página, cuando no es como se guarda.
 *
 * En Configuración el análisis discursivo lleva el autor del modelo, que es lo
 * que necesita quien codifica. Quien contrata no sabe quién es, y un apellido
 * entre paréntesis en el nombre del test se lee como un requisito más.
 */
const ROTULO: Record<string, string> = {
  'Análisis discursivo (Elliot Jaques)': 'Análisis discursivo',
};

/**
 * De dónde sale cada capítulo, con los tests que esa batería toma.
 *
 * Es lo que ata el alcance con la entrega: leídas por separado, la lista de
 * pruebas y la de capítulos parecen dos cosas que se compran juntas por
 * costumbre. Sale de los mismos tests que se tildan en Configuración, así que
 * una batería a la que se le cambia una prueba cambia también esta frase.
 */
function deDondeSale(tests: string[]): string {
  // Sin artículo delante: van encadenados detrás de "el cruce de", donde "de
  // el Rorschach" sale mal escrito.
  const proyectivo = tests.includes('Rorschach')
    ? 'Rorschach'
    : tests.includes('Zulliger')
      ? 'Zulliger'
      : '';
  const graficas = [
    tests.includes('Bender') ? 'Bender' : '',
    tests.includes('Gráfico 2 personas') ? 'gráfico de dos personas' : '',
  ].filter(Boolean);
  const cognitivo = tests.includes('Raven') ? ' y Raven' : '';
  const entrevista = tests.includes('Entrevista por competencias');
  const discursivo = tests.some((t) => t.startsWith('Análisis discursivo'));

  const base = [proyectivo, ...graficas].filter(Boolean).join(', ');
  if (!base) return '';

  const competencias = `El mapa de competencias sale del cruce de ${base}${cognitivo}`;
  const lider = entrevista
    ? `, y las recomendaciones para su líder salen de esas mismas pruebas cruzadas con lo que contó en la entrevista por competencias`
    : '';
  const potencial = discursivo
    ? '. El informe de potencial sale del análisis discursivo, que se toma sobre cinco minutos de su propio relato'
    : '';
  return `${competencias}${lider}${potencial}.`;
}

function prosaDeEntrega(entrega: string[], tests: string[]): string[] {
  const partes = entrega.map((e) => ENTIENDE[e]).filter(Boolean);
  if (partes.length === 0) return [];
  const lista =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join('; ')}; y ${partes[partes.length - 1]}`;
  const cierre = entrega.includes('Informe de potencial')
    ? 'Leído entero, quien decide sabe si esta persona rinde en el puesto, con qué apoyo, y qué puede esperar de ella en los próximos años.'
    : 'Leído entero, quien decide sabe si esta persona rinde en el puesto, qué le va a costar más y con qué apoyo rinde mejor.';
  // Abre por cuántos capítulos son y no por el soporte: lo que se compra es el
  // trabajo que hay adentro, y "un documento" lo cuenta al revés, por la
  // cantidad de archivos que llegan.
  // En dos párrafos: primero qué capítulos son, y aparte de qué prueba sale
  // cada uno. De corrido son doce renglones y el segundo dato queda enterrado
  // en el medio.
  return [
    `${CUANTOS[partes.length]} capítulos de recomendaciones, firmados por la psicóloga que la entrevistó: ${lista}.`,
    [deDondeSale(tests), cierre].filter(Boolean).join(' '),
  ].filter(Boolean);
}

/**
 * En qué baterías el perfil de pensamiento va como recomendado.
 *
 * Por código y no por precio ni por posición: la 1 cubre puestos operativos,
 * donde lo que se pregunta es si la persona sostiene la tarea, y las otras dos
 * cubren puestos donde decide o conduce a otros, que es donde saber cómo piensa
 * cambia a quién se le pone al lado.
 */
function recomendado(codigo: string): boolean {
  return codigo !== 'Batería 1';
}

export default async function Precios() {
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
        <p className="precios-marca">
          <span className="precios-marca-nombre">
            Campos HR. <span>Evaluaciones psicotécnicas</span>
          </span>
          {/* El sitio arriba y a la derecha, en la misma línea del logotipo:
              es donde se lo busca cuando la página llega reenviada y ya no se
              sabe de dónde salió. */}
          <a className="precios-sitio" href="https://www.camposhr.com">
            camposhr.com
          </a>
        </p>
        {/* El titular nombra el trabajo que se contrata, no el posicionamiento
            del estudio: quien abre esto tiene un finalista y necesita decidir,
            con alguien que se haga cargo de la opinión.

            Abre por el entregable y cierra con las tres palabras del rubro: en
            un informe psicolaboral la conclusión es "apto", "apto con
            observaciones" o "no apto", y esas tres son las que después se citan
            en la reunión donde se decide. Empezando por ellas, el titular era
            una lista antes de decir de qué. */}
        {/* Lo decimos nosotras y no "te ayudamos a": lo que se contrata es la
            recomendación tomada, no un apoyo para que la tome el cliente. */}
        {/* El corte de renglón es parte del titular y no lo decide el ancho:
            arriba la promesa, abajo con qué se sostiene. */}
        <h1>
          Definimos a quién contratar,
          <br />
          con la evidencia que lo respalda
        </h1>
      </header>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Evaluaciones psicotécnicas</h2>
        <div className="precios-lista">
          {conDetalle.map((b) => (
            <article className="precios-item" key={b.codigo}>
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

              <h3 className="precios-item-titulo">{b.paraQuien}</h3>

              {/* Para quién es y cuándo conviene: es lo que decide entre una y
                  otra, y sin esto había que deducirlo de la lista de tests. */}
              {CUANDO[b.codigo] && (
                <p className="precios-cuando">{CUANDO[b.codigo]}</p>
              )}

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
                          <span>
                            <strong>{ROTULO[t] ?? t}.</strong> {QUE_ES[t] ?? ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {b.entrega.length > 0 && (
                  <div className="precios-detalle precios-detalle-entrega">
                    <span className="precios-detalle-titulo">Entrega</span>
                    {prosaDeEntrega(b.entrega, b.tests).map((parrafo) => (
                      <p key={parrafo}>{parrafo}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* El perfil de pensamiento no está en ninguna batería: se suma a
                  la que sea, así que se ofrece en las tres con lo que aporta y
                  su precio, y no en una sección aparte que hay que ir a buscar
                  para entender de qué se trata.

                  En la 2 y la 3 va como recomendado y no como opcional: en un
                  puesto donde la persona decide o conduce, cómo piensa cambia
                  con quién se la combina y cómo se la conduce, y eso se pide en
                  casi todos esos pedidos. */}
              <div
                className={`precios-opcional${
                  recomendado(b.codigo) ? ' precios-sugerido' : ''
                }`}
              >
                <span className="precios-detalle-titulo">
                  {recomendado(b.codigo) ? 'Recomendado' : 'Opcional'}
                </span>
                <p>
                  <strong className="precios-opcional-nombre">
                    Evaluación de perfil de pensamiento (Benziger).
                  </strong>{' '}
                  Dice
                  con qué parte del cerebro trabaja cómoda la persona, cuál le cuesta y
                  qué le pasa cuando el puesto le exige trabajar desde la que le
                  cuesta. Sirve para
                  armar equipos que se complementen y para saber cómo conducir a cada
                  uno.
                  {recomendado(b.codigo)
                    ? ' En puestos de decisión y de conducción se suma en la mayoría de los pedidos.'
                    : ''}
                </p>
                {/* El precio está fijado en dólares y se factura al cambio del
                    día. Con el equivalente en pesos pegado al número en dólares
                    se leía como un precio cerrado en pesos, y a la semana
                    siguiente el mismo agregado sale otra cifra. */}
                <p className="precios-opcional-precio">
                  USD {benzigerUsd} por candidato, a sumar al precio de arriba. Se
                  factura en pesos al dólar tarjeta del día en que se emite la
                  factura{benziger ? `: al de hoy son ${pesos(benziger)}` : ''}.
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Las tres al lado, para elegir de un vistazo.
          Las tarjetas de arriba cuentan cada una por separado y contestan "qué
          es esta"; acá se contesta la otra pregunta, que es "en qué se
          diferencian". Las filas son lo que efectivamente cambia entre ellas:
          lo que se toma de más y lo que se entrega de más. Lo que está en las
          tres no se lista, porque una columna con tres tildes iguales no
          distingue nada. */}
      {/* Con línea arriba: cierra las tres tarjetas y abre la lectura
          transversal, que es otra forma de mirar lo mismo. */}
      <section className="precios-bloque precios-bloque-linea">
        <h2 className="precios-titulo">Comparación</h2>
        <div className="precios-tabla-marco">
          <table className="precios-tabla">
            <thead>
              <tr>
                <th />
                {conDetalle.map((b) => (
                  <th key={b.codigo}>
                    <span className={`precios-pill ${colorDe(b.codigo)}`}>{b.codigo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Para quién</th>
                {conDetalle.map((b) => (
                  <td key={b.codigo}>{b.paraQuien}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Precio por candidato</th>
                {conDetalle.map((b) => (
                  <td key={b.codigo} className="precios-tabla-monto">
                    {b.precio === null ? 'A convenir' : pesos(b.precio)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Dura</th>
                {conDetalle.map((b) => (
                  <td key={b.codigo}>{b.minutos ? `${b.minutos} min` : '—'}</td>
                ))}
              </tr>
              {/* El perfil de pensamiento va en la tabla porque se puede sumar
                  a cualquiera de las tres, con el mismo precio: sin esta fila,
                  quien compara acá no se entera de que existe. */}
              {[
                ...DIFERENCIAS,
                {
                  que: 'Perfil de pensamiento (Benziger)',
                  en: () => true,
                  valor: (b: Bateria) =>
                    `${recomendado(b.codigo) ? 'Recomendado' : 'Opcional'} · USD ${benzigerUsd}`,
                } as Fila,
              ].map((fila) => (
                <tr key={fila.que}>
                  <th scope="row">{fila.que}</th>
                  {conDetalle.map((b) => {
                    const tiene = fila.en(b);
                    // Lo que se dice con un texto (qué proyectivo, con qué
                    // precio) va tal cual; lo que se contesta con sí o no va en
                    // pastilla de color, que es lo que se busca al recorrer la
                    // tabla con la vista.
                    const texto = tiene ? fila.valor?.(b) : undefined;
                    return (
                      <td key={b.codigo}>
                        {texto !== undefined ? (
                          texto
                        ) : (
                          <span
                            className={`precios-marca-tabla ${
                              tiene ? 'precios-marca-si' : 'precios-marca-no'
                            }`}
                          >
                            {tiene ? 'Sí' : 'No'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="precios-nota">
          Las tres incluyen prueba gráfica, test cognitivo y entrevista por
          competencias. La tabla lista solamente lo que cambia de una a otra.
        </p>
      </section>

      {/* Dos secciones y no cuatro: qué llega y cómo se pide.

          Hasta el 27/8/2026 esto eran "Qué se está midiendo", "Qué recibe la
          empresa", "Lo que necesitamos de vos" y "Cómo es el proceso", cuatro
          títulos para dos preguntas. Quien lee está comparando proveedores con
          la pestaña abierta al lado: lo que se mide ya está arriba, en cada
          batería, y lo que hace falta de su lado es el primer paso del proceso
          y no un capítulo aparte. */}
      <section className="precios-bloque">
        <h2 className="precios-titulo">Entregables</h2>
        <p className="precios-parrafo">
          Un informe por candidato, firmado por la psicóloga que lo entrevistó. Abre
          por el veredicto y sigue con el detalle, en este orden:
        </p>
        {/* Cada capítulo con su letra, como se lo cita después: "lo que dice
            el punto B". La letra ordena la lectura, que es lo que la línea de
            color al costado no hacía. */}
        <ul className="precios-entrega">
          {QUE_LLEGA.map((x, i) => (
            <li key={x.que}>
              <span className="precios-num">{'ABCDEFG'[i]}</span>
              <span>
                <span className="precios-entrega-paso">{x.cuando}</span>
                <strong>{x.que}.</strong> {x.comoEs}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Entre lo que se entrega y cómo se pide: quien acaba de leer qué llega
          escrito quiere ver cómo lo va a ver, y el paso siguiente es el portal.
          Va a la empresa de prueba, con candidatos inventados. */}
      <section className="precios-bloque">
        <a className="precios-demo" href={`https://clientes.camposhr.com/${TOKEN_PORTAL_EJEMPLO}`}>
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
            <span className="precios-demo-rotulo">Portal del cliente</span>
            <strong>Ver un portal de ejemplo</strong>
            <span className="precios-demo-bajada">
              Una empresa de muestra, con sus búsquedas, sus candidatos en proceso y
              un informe completo para leer.
            </span>
          </span>
          <span className="precios-demo-flecha" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                d="M5 12h13M13 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </a>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">Cómo es el proceso</h2>
        {/* Tres pasos, cada uno con su número en círculo y su tarjeta: el mismo
            lenguaje que el alcance y los entregables, que se leen con el número
            al costado. Como lista numerada del navegador, los tres párrafos
            largos se leían como un texto corrido con dígitos adelante. */}
        <ol className="precios-pasos">
          <li>
            <span className="precios-num">1</span>
            <div>
              <strong>Nos mandás el pedido.</strong> Desde tu portal de cliente: el
              puesto, los CV y unas preguntas sobre cómo es el puesto y cómo conduce
              quien va a ser su jefe.
            </div>
          </li>
          <li>
            <span className="precios-num">2</span>
            <div>
              <strong>Citamos y evaluamos.</strong> La coordinación con cada candidato
              la hacemos nosotras, presencial o por videollamada, y la fecha se acuerda
              según su disponibilidad.
            </div>
          </li>
          <li>
            <span className="precios-num">3</span>
            <div>
              <strong>Recibís el informe en menos de cinco días</strong> desde la
              entrevista. Queda disponible en tu portal, y también llega por los
              canales acordados. Hasta entonces, el portal muestra el estado de cada
              candidato en el proceso.
              {/* El plazo real, contado por el sistema sobre las entregas ya
                  hechas: un número escrito a mano promete lo que se cumplía el
                  día que alguien lo redactó. Si todavía no hay casos suficientes
                  no sale nada, y queda solo la promesa. */}
              {plazo && (
                <span className="precios-plazo">
                  <strong>{plazo.dias.toLocaleString('es-AR')} días</strong>
                  <span>
                    plazo promedio de entrega, medido desde la entrevista hasta la
                    publicación del informe en el portal
                  </span>
                </span>
              )}
            </div>
          </li>
        </ol>
        {/* Cómo se empieza, pegado al proceso que acaba de leer: es el único
            paso que le toca dar a quien está decidiendo. A quién escribirle va
            al final de la página, con el resto de los datos del estudio. */}
        <p className="precios-cierre">
          Para empezar, escribinos un WhatsApp al{' '}
          <a className="precios-wa" href="https://wa.me/5493416402533">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z"
              />
            </svg>
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

      {/* Quiénes firman, con nombre, matrícula y cara. En una decisión así lo
          que se compra es el criterio de quien firma, y un informe sin autor
          identificable vale menos que uno con matrícula al pie. */}
      <section className="precios-bloque">
        <h2 className="precios-titulo">Evaluadoras</h2>
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
                <p className="precios-persona-titulo">
                  {p.titulo}
                  {/* El perfil profesional y no el correo: acá se está mirando
                      quién firma, y en LinkedIn está la trayectoria entera.
                      Escribirles es un paso posterior y tiene su lugar en el
                      proceso. */}
                  <a
                    className="precios-linkedin"
                    href={p.linkedin}
                    aria-label={`LinkedIn de ${p.nombre}`}
                    title={`LinkedIn de ${p.nombre}`}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"
                      />
                    </svg>
                    LinkedIn
                  </a>
                </p>
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
        <h2 className="precios-titulo">
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
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z"
              />
            </svg>
            +54 9 341 640 2533
          </a>
          <span>·</span>
          Rosario, Argentina
          <span>·</span>
          <a href="https://www.camposhr.com">camposhr.com</a>
        </p>
      </div>
      </div>
    </footer>
    </>
  );
}
