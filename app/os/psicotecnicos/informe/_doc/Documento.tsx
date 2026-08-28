import { bandaDe, bandasDe } from '@/lib/exigencia';
import { EscalaBandas, IconoNivel, Velocimetro, tono } from './piezas';
import type { Informe } from '@/lib/informe';
import {
  CONFIDENCIALIDAD,
  CUADRANTES,
  FIRMAS,
  NIVELES,
  NOTA_AJUSTE,
} from '@/lib/informe-textos';
import Cerebro from './Cerebro';
import Piramide from './Piramide';
import { CONDICIONES } from '@/lib/discursivo';
import Listas from './Listas';
import { Encabezado, Marca, Pie } from './Marco';
import { firmaEnDatos } from '@/lib/firmas';
import Crudo from './Crudo';
import { Desglose, Faltantes } from './Interno';
import './informe.css';

function Capitulo({
  numero,
  titulo,
  sub,
  children,
}: {
  numero: string;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inf-capitulo">
      <header className="inf-capitulo-top">
        <span className="inf-numero">{numero}</span>
        <div>
          <h2>{titulo}</h2>
          {sub && <p className="inf-sub">{sub}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * En qué parte del informe está cada capítulo.
 *
 * El portal del cliente lo entrega en tres profundidades, y cada una se lee y
 * se descarga por separado:
 *
 * - `recomendacion`: qué se recomienda y por qué, escrito y firmado por la
 *   evaluadora. Es lo que decide, y entra en una hoja.
 * - `fundamentos`: en qué se apoya esa recomendación. Las competencias, el
 *   análisis de cada una, lo que le conviene a su líder, los estilos de
 *   pensamiento y el potencial.
 * - `indicadores`: los números, sin interpretar y sin colores.
 *
 * `todo` es el documento entero, en ese mismo orden: es lo que se imprime desde
 * el OS y lo que baja el cliente cuando pide las tres partes juntas.
 *
 * `trabajo` es lo mismo sin los indicadores, y es lo que se ve en la pestaña
 * Informe de la ficha: ahí la evaluadora está revisando lo que se afirma, y los
 * números crudos ya los tiene en sus propias pestañas, a un clic de distancia.
 */
export type Parte = 'todo' | 'trabajo' | 'recomendacion' | 'fundamentos' | 'indicadores';

/**
 * El documento en sí, con el informe ya armado.
 *
 * Lo usan las dos pantallas: la pestaña de la ficha, que lo muestra mientras se
 * carga, y la página suelta, que es la que se imprime. Un solo molde, para que
 * lo que se revisa en pantalla sea exactamente lo que sale en el PDF.
 */
export default async function Documento({
  inf,
  interno = false,
  editar,
  parte = 'todo',
  marco = true,
}: {
  inf: Informe;
  /**
   * Lo que solo mira el equipo: qué falta cargar y de dónde sale cada
   * porcentaje. Va apagado por defecto, así una pantalla nueva que muestre el
   * informe no filtra por olvido: para que el cliente lo vea hay que pedirlo.
   */
  interno?: boolean;
  /**
   * El id de la evaluación, cuando las cuatro listas se pueden editar.
   *
   * Va solo en la ficha, que es donde se trabaja el informe. La vista para
   * imprimir no lo pasa: ahí el documento ya está cerrado y un botón de editar
   * saldría en el papel.
   */
  editar?: string;
  /**
   * Qué parte del informe se dibuja. Entera, salvo que se pida una sola.
   *
   * Cada parte sale como un documento completo, con su marca, su encabezado y
   * su firma: el cliente puede bajar una sola y lo que baja tiene que decir de
   * quién es y de quién habla.
   */
  parte?: Parte;
  /**
   * Si dibuja la marca de arriba, el encabezado con quién es y el pie.
   *
   * El portal los saca porque los dibuja una vez para las tres pestañas: ahí el
   * informe se lee como una página y no como tres documentos apilados.
   */
  marco?: boolean;
}) {
  const firma = inf.evaluadora ? FIRMAS[inf.evaluadora] : undefined;
  /* La firma manuscrita entra como datos y no como dirección: el informe se
     imprime a PDF y se guarda, y una dirección firmada que vence dejaría ese
     papel sin firma al día siguiente. */
  const trazo = firma?.trazo ? await firmaEnDatos(firma.trazo) : null;

  /** Si este capítulo entra en lo que se está dibujando. */
  const va = (cual: Exclude<Parte, 'todo' | 'trabajo'>) =>
    parte === 'todo' ||
    parte === cual ||
    (parte === 'trabajo' && cual !== 'indicadores');

  // Los capítulos se numeran solos. Escritos a mano, un informe sin Benziger
  // saltaba de 04 a 06, y ahora hay dos capítulos que pueden faltar. Pedida una
  // sola parte, la numeración arranca de nuevo en 01, que es lo que corresponde
  // a un documento que se lee solo.
  let ultimo = 0;
  const num = () => String(++ultimo).padStart(2, '0');

  /* Sin marco no lleva la clase `inf`: la pone el portal una sola vez, y
     anidada le sumaría otro ancho máximo y otro margen al de afuera. */
  return (
    <article className={marco ? 'inf' : 'inf-cuerpo'} data-parte={parte}>
      {interno && <Faltantes inf={inf} />}

      {/* La marca y quién es, salvo en el portal, que las dibuja una vez
          para las tres pestañas. */}
      {marco && (
        <>
          <Marca />
          <Encabezado inf={inf} />
        </>
      )}

      {/* ── Recomendación ───────────────────────────────────────────────
          Qué se recomienda y por qué. La escribe y la firma la evaluadora: el
          resto del informe lo arma el sistema con lo que dio la evaluación,
          esto no. */}
      {va('recomendacion') && (
      <Capitulo numero={num()} titulo="Conclusiones">
        <div className="inf-semaforo">
          {NIVELES.map((nv) => {
            const elegido = inf.nivel?.clave === nv.clave;
            return (
              <article
                key={nv.clave}
                className={`inf-nivel ${nv.color}${elegido ? ' elegido' : ''}`}
                aria-current={elegido ? 'true' : undefined}
              >
                <IconoNivel clave={nv.clave} />
                <div>
                  <h3>{nv.titulo}</h3>
                  <p>{nv.texto}</p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="inf-nota">{NOTA_AJUSTE}</p>

        {/* Dos cosas distintas, en este orden. El resumen es qué dio la
            evaluación, y lo arma el motor con las mismas lecturas que el resto
            del informe. La fundamentación es por qué se recomienda ese nivel, y
            la escribe la evaluadora cuando lo elige. */}
        <h3 className="inf-subtitulo">Resumen</h3>
        {inf.resumen.map((t, i) => (
          <p key={i}>{t}</p>
        ))}

        {inf.fundamentacion.length > 0 && (
          <>
            <h3 className="inf-subtitulo">Fundamentación</h3>
            {inf.fundamentacion.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </>
        )}
      </Capitulo>
      )}

      {/* ── Competencias ────────────────────────────────────────────────── */}
      {va('fundamentos') && (
      <Capitulo numero={num()} titulo="Competencias evaluadas">
        {inf.competencias.length === 0 ? (
          <p className="inf-vacio">
            Sin sumario cargado no se pueden calcular las competencias.
          </p>
        ) : (
          <>
            {/* Tablero: una tarjeta por competencia, el anillo primero y el
                texto después. El número es lo que el cliente busca, así que va
                donde cae el ojo y no al final de un renglón. Las nueve miden lo
                mismo: lo que solo vale para una va al pie. */}
            {/* Cuando el protocolo no alcanza no se puntúa ninguna de las que
                salen de él, y hay que decir por qué: "sin datos" a secas
                invita a pensar que falta cargar algo, y lo que pasa es que lo
                cargado no permite afirmar nada. */}
            {inf.protocoloCorto && (
              <p className="inf-nota-protocolo">
                Las competencias que salen del test de manchas van sin puntaje:{' '}
                {inf.protocoloCorto}.
              </p>
            )}

            <div className="inf-competencias">
              {inf.competencias.map((c) => {
                const banda = bandaDe(c.puntaje, inf.exigencia);
                return (
                  <article key={c.nombre} className="inf-competencia">
                    <Velocimetro puntaje={c.puntaje} exigencia={inf.exigencia} />
                    <h3>{c.nombre}</h3>
                    {c.puntaje !== null && (
                      <span
                        className="inf-banda-texto"
                        style={{ color: tono(c.puntaje, 1, inf.exigencia) }}
                      >
                        {banda}
                      </span>
                    )}
                    <p className="inf-mide">{c.mide}</p>
                  </article>
                );
              })}
            </div>
            <EscalaBandas exigencia={inf.exigencia} />
          </>
        )}
      </Capitulo>
      )}

      {/* ── Análisis cualitativo ────────────────────────────────────────── */}
      {va('fundamentos') && (
      <Capitulo numero={num()} titulo="Análisis cualitativo de las competencias">
        {(
          [
            [
              'destacado',
              'destacadas',
              'Desarrollo destacado',
              'Por encima del rango esperado',
              inf.analisis.destacadas,
            ],
            [
              'esperado',
              'esperadas',
              'Desarrollo esperado',
              'Dentro del rango esperado',
              inf.analisis.esperadas,
            ],
            [
              'desarrollar',
              'desarrollar',
              'Necesidad de desarrollo',
              'Fuera del rango esperado: conviene acompañar',
              inf.analisis.desarrollar,
            ],
          ] as const
        ).map(([clave, lista, titulo, sub, dichos]) => (
          /* El grupo entero lo dibuja `Listas`, con encabezado y todo: el botón
             de editar va arriba, al lado de la cuenta, y desde acá no se puede
             meter nada adentro de un encabezado que se dibuja allá. */
          <Listas
            key={clave}
            id={editar}
            lista={lista}
            items={dichos}
            intervenida={inf.intervenidas.includes(lista)}
            vacio="Sin registros en este grupo."
            // El respaldo va solo donde va el botón de editar: es de quien
            // firma el informe, no del cliente que lo lee.
            respaldos={editar ? inf.respaldos : undefined}
            grupo={{ clave, titulo, sub }}
          />
        ))}
      </Capitulo>
      )}

      {/* ── Recomendaciones al líder ────────────────────────────────────── */}
      {va('fundamentos') && (
      <Capitulo numero={num()} titulo="Recomendaciones para su líder directo">
        <Listas
          id={editar}
          lista="recomendaciones"
          items={inf.recomendaciones}
          intervenida={inf.intervenidas.includes('recomendaciones')}
          numerada
          vacio="No surgen indicadores fuera de los rangos esperados que requieran una gestión particular."
          respaldos={editar ? inf.respaldos : undefined}
        />
      </Capitulo>
      )}

      {/* ── Benziger ────────────────────────────────────────────────────── */}
      {va('fundamentos') && inf.benziger && (
        <Capitulo
          numero={num()}
          titulo="Estilos de pensamiento predominantes"
          sub="Según BTSA (Benziger Thinking Styles Assessment)"
        >
          <div className="inf-referencia-perfil">
            <span className="inf-ref adulto">Perfil adulto</span>
            <span className="inf-ref joven">Perfil adolescente</span>
          </div>

          <div className="inf-benziger">
            {CUADRANTES.map((q) => {
              const manda = inf.benziger!.preferentes.some((p) => p.clave === q.clave);
              return (
                <div
                  key={q.clave}
                  className={manda ? `inf-cuadrante ${q.clave} manda` : `inf-cuadrante ${q.clave}`}
                >
                  <span className="inf-cuadrante-rotulo">
                    {manda ? 'Predominante' : 'Cuadrante'}
                  </span>
                  <h3>{q.nombre}</h3>
                  <p>{q.resumen}</p>
                </div>
              );
            })}
            <Cerebro adulto={inf.benziger.adulto} joven={inf.benziger.joven} />
          </div>

          {inf.benziger.preferentes.length > 0 && (
            <p className="inf-rotulo-preferente">
              {inf.benziger.preferentes.length === 1
                ? 'Cuadrante predominante'
                : 'Cuadrantes predominantes'}
            </p>
          )}
          {inf.benziger.preferentes.map((q) => (
            <div key={q.clave} className="inf-bloque">
              <h3 className="inf-subtitulo">{q.nombre}</h3>
              <ul className="inf-lista">
                {q.caracteristicas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </Capitulo>
      )}

      {/* ── Potencial de desarrollo ─────────────────────────────────────── */}
      {va('fundamentos') && inf.discursivo && (
        <Capitulo
          numero={num()}
          titulo="Potencial de desarrollo"
          sub="Según análisis discursivo (modelo de Elliot Jaques)"
        >
          <div className="inf-potencial">
            <p>
              El análisis estima el nivel de complejidad de trabajo que la persona puede
              abordar hoy, que no es lo mismo que el cargo que ocupa ni que su desempeño
              actual. Que esa capacidad llegue a aplicarse en un rol depende además de:
            </p>
            <ol className="inf-condiciones">
              {CONDICIONES.map((c, i) => (
                <li key={c}>
                  <span className="inf-orden inf-orden-hueco">{i + 1}</span>
                  <p>{c}</p>
                </li>
              ))}
            </ol>

            <div className="inf-piramide-caja">
              <Piramide nivel={inf.discursivo.nivel} textos={inf.discursivo.escalones} />
            </div>

            {/* El capítulo lo arma el catálogo del instrumento y no lo que
                escriba la evaluadora: qué complejidad de trabajo puede abordar
                hoy quien quedó en ese estrato y qué exige el siguiente. Su
                lectura sobre esta persona, si la escribió, va después. Se edita
                en Configuración → Potencial. */}
            {/* El puesto, en la misma escala. Es la comparación que decide: la
                evaluación mide a la persona y lo que hay que resolver es si
                eso alcanza para este puesto. Sale solo cuando el pedido tiene
                determinado su nivel de trabajo. */}
            {inf.discursivo.puesto && (
              <p className="inf-ajuste-puesto">
                <strong>
                  El puesto es de estrato {inf.discursivo.puesto.romano} ·{' '}
                  {inf.discursivo.puesto.nombre}.
                </strong>{' '}
                {inf.discursivo.puesto.distancia === 0
                  ? 'La persona puede abordar hoy la complejidad que el puesto exige.'
                  : inf.discursivo.puesto.distancia > 0
                    ? 'La complejidad que la persona puede abordar hoy está por encima de la que el puesto exige, así que el puesto le va a quedar corto en cuanto lo domine.'
                    : 'La complejidad que el puesto exige está por encima de la que la persona puede abordar hoy.'}
              </p>
            )}

            {inf.discursivo.detalle && (
              <>
                <h3>Capacidad potencial actual</h3>
                <p className="inf-estrato-marca">
                  Estrato {inf.discursivo.detalle.romano} · procesamiento{' '}
                  {inf.discursivo.detalle.procesamiento.toLowerCase()} · horizonte temporal:{' '}
                  {(() => {
                    // Entra a mitad de la frase, así que arranca en minúscula y
                    // sin el punto final que sí lleva en la pantalla que lo edita.
                    const h = inf.discursivo.detalle.horizonte.replace(/\.$/, '');
                    return h.charAt(0).toLowerCase() + h.slice(1);
                  })()}
                </p>
                <p>{inf.discursivo.detalle.actual}</p>
                {inf.discursivo.detalle.ejemplos.length > 0 && (
                  <>
                    <p className="inf-estrato-marca">En el trabajo suele verse en:</p>
                    <ul className="inf-estrato-ejemplos">
                      {inf.discursivo.detalle.ejemplos.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {inf.discursivo.actual && <p>{inf.discursivo.actual}</p>}

            {inf.discursivo.detalle && (
              <>
                <h3>Capacidad potencial futura</h3>
                <p>{inf.discursivo.detalle.proyeccion}</p>
              </>
            )}
            {inf.discursivo.futura && <p>{inf.discursivo.futura}</p>}

          </div>
        </Capitulo>
      )}

      {/* ── Técnicas ───────────────────────────────────────────────────
          Con qué se la evaluó: es parte de en qué se apoya lo que el informe
          dice, así que va con los fundamentos y no con los números. */}
      {va('fundamentos') && (
      <Capitulo numero={num()} titulo="Técnicas de evaluación utilizadas">
        <ul className="inf-lista">
          {inf.tecnicas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Capitulo>
      )}

      {/* ── Indicadores ─────────────────────────────────────────────────
          Los números de los que salió todo lo anterior, en tablas y sin un solo
          color: es la parte que se imprime, se archiva y se compara contra la
          de otro candidato, y ahí un puntaje pintado de verde no agrega nada
          que la tabla no diga. */}
      {va('indicadores') && (
        <Capitulo
          numero={num()}
          titulo="Indicadores"
          sub="Los valores medidos, sin interpretación"
        >
          <Crudo inf={inf} />
        </Capitulo>
      )}

      {/* ── Profesional a cargo ─────────────────────────────────────────
          Va en las tres partes: cada una se descarga sola, y un documento
          suelto tiene que decir quién lo firma y bajo qué condición se
          entrega. */}
      <Capitulo numero={num()} titulo="Profesional a cargo">
        <p className="inf-confidencial">{CONFIDENCIALIDAD}</p>
        <div className="inf-firma">
          {/* La firma manuscrita arriba del nombre, como en un papel: sirve
              para eso, para que se vea que alguien lo firmó. Sin texto
              alternativo, que lo que dice está en el renglón de abajo. */}
          {trazo && <img className="inf-firma-trazo" src={trazo} alt="" />}
          <strong>{inf.evaluadora ?? 'Sin evaluadora asignada'}</strong>
          {firma && (
            <>
              <span>
                {firma.titulo} · Mat. {firma.matricula}
              </span>
              {firma.correo && <span>{firma.correo}</span>}
            </>
          )}
        </div>
      </Capitulo>

      {marco && <Pie />}

      {interno && <Desglose inf={inf} />}
    </article>
  );
}
