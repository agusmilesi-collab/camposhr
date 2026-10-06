import { parrafoBenziger, type Informe } from '@/lib/informe';
import { bandaDe } from '@/lib/exigencia';
import { CONFIDENCIALIDAD, CUADRANTES, FIRMAS, NIVELES, NOTA_AJUSTE } from '@/lib/informe-textos';
import { firmaEnDatos } from '@/lib/firmas';
import Listas from '../_doc/Listas';
import { Desglose } from '../_doc/Interno';
import { EscalaBandas, IconoNivel, RadarCompetencias, Velocimetro, tono } from '../_doc/piezas';
import Cerebro from '../_doc/Cerebro';
import Crudo from '../_doc/Crudo';
import Escalera from './Escalera';
import BenzigerLecturas from '../_doc/BenzigerLecturas';
import EditarBenziger from '../_doc/EditarBenziger';

/**
 * El informe del cliente, partido en secciones que se navegan.
 *
 * Es la misma evaluación que arma el documento que se descarga, contada como se
 * lee una página y no como se lee un papel: primero lo que hay que decidir, y
 * cada cosa que lo sostiene en su propia sección, a un clic del índice.
 *
 * **El documento no desaparece**: sigue siendo lo que se imprime y lo que se
 * baja en PDF, y se dibuja en la misma página, escondido hasta que alguien
 * imprime. Lo que cambia es cómo se lee en pantalla.
 */

/**
 * Quién firma, con su firma.
 *
 * Es asincrónico porque el trazo se lee del bucket privado y entra al documento
 * como datos. React espera un componente de servidor asincrónico como
 * cualquier otro, así que se usa como un elemento más.
 */
async function Firma({ inf }: { inf: Informe }) {
  const firma = inf.evaluadora ? FIRMAS[inf.evaluadora] : undefined;
  const trazo = firma?.trazo ? await firmaEnDatos(firma.trazo) : null;
  /* La firma cierra la fundamentación: es de quien la escribió, así que va
     debajo de sus palabras y no en un bloque aparte con una línea en el medio.
     La nota de confidencialidad va después, que es del documento y no de ella. */
  return (
    <>
      <div className="sitio-firma">
        {trazo && <img className="sitio-trazo" src={trazo} alt="" />}
        <strong>{inf.evaluadora ?? 'Sin evaluadora asignada'}</strong>
        {firma && (
          <>
            <span>
              {firma.titulo} · Mat. {firma.matricula}
            </span>
            {/* El correo en su propio renglón: es por dónde se la busca, y al
                final de la matrícula se lee como parte del número. */}
            {firma.correo && <span>{firma.correo}</span>}
          </>
        )}
      </div>
      <p className="sitio-confidencial">{CONFIDENCIALIDAD}</p>
    </>
  );
}

/** Cómo se nombra cada nivel adentro de la nota, donde "ajuste" ya está dicho. */
const ETIQUETA_CORTA: Record<string, string> = {
  alto: 'Alto',
  desarrollar: 'A desarrollar',
  alertas: 'Con alertas',
  bajo: 'Bajo',
};

export type Seccion = {
  /** El ancla de la dirección y el destino del índice. */
  id: string;
  /** Cómo se llama en el índice. */
  titulo: string;
  /** Una línea que dice qué se contesta ahí. */
  bajada?: string;
  cuerpo: React.ReactNode;
};

export function seccionesDe(
  inf: Informe,
  /**
   * El id de la evaluación, cuando las cuatro listas se pueden editar.
   *
   * Va solo en la ficha: ahí la evaluadora ve exactamente lo que va a ver el
   * cliente, y corrige sobre eso. En el portal no se pasa, y las listas salen
   * como texto.
   */
  editar?: string,
): Seccion[] {
  const secciones: Seccion[] = [];

  /* ── Recomendación ──────────────────────────────────────────────────
     Lo primero y lo único que hace falta para decidir: qué se recomienda, por
     qué, y quién lo firma. Los otros tres niveles se muestran apagados porque
     el semáforo se lee comparando: sin ellos, "ajuste alto" no dice contra
     qué. */
  secciones.push({
    id: 'recomendacion',
    titulo: 'Conclusiones',
    cuerpo: (
      <>
        {/* El nivel elegido grande, con su texto, y los otros tres en una
            línea chica debajo: quien lee ve dónde cae la persona y la escala
            entera, sin que las cuatro tarjetas completas se lleven media hoja
            del one pager. Sin nivel elegido van los cuatro en la línea. */}
        {(() => {
          const elegido = NIVELES.find((nv) => nv.clave === inf.nivel?.clave);
          const otros = NIVELES.filter((nv) => nv.clave !== elegido?.clave);
          return (
            <>
              {elegido && (
                <article className={`inf-nivel ${elegido.color} elegido`} aria-current="true">
                  <IconoNivel clave={elegido.clave} />
                  <div>
                    <h3>{elegido.titulo}</h3>
                    <p>{elegido.texto}</p>
                  </div>
                </article>
              )}
              {/* Los otros niveles, en prosa al final de la nota: dicen que
                  es una escala y dónde está parada la persona, sin ocupar
                  una línea de tarjetas. */}
              <p className="inf-nota">
                {NOTA_AJUSTE}{' '}
                {elegido ? 'Otros niveles:' : 'Niveles:'}{' '}
                {/* Cada nivel en su etiqueta, del color con que se lo pinta
                    cuando es el elegido: la escala se reconoce sin leerla. */}
                {otros.map((nv, i) => (
                  <span key={nv.clave}>
                    {i > 0 && (i === otros.length - 1 ? ' y ' : ', ')}
                    <span className={`inf-nivel-tag ${nv.color}`}>
                      {ETIQUETA_CORTA[nv.clave] ?? nv.titulo}
                    </span>
                  </span>
                ))}
                .
              </p>
            </>
          );
        })()}

        <h3 className="sitio-sub">Resumen</h3>
        {/* Un solo párrafo, sin punto y aparte: es el resumen del one pager y
            se lee de corrido. */}
        {inf.resumen.length > 0 && <p>{inf.resumen.join(' ')}</p>}

        {/* Lo que escribió la evaluadora se destaca del resto: es la única
            parte del informe que dice "yo la entrevisté y esto me parece", y
            leerla al mismo cuerpo que lo que arma el motor la hace pasar por
            una conclusión más. */}
        {inf.fundamentacion.length > 0 && (
          <div className="sitio-cita">
            <h3 className="sitio-sub">Fundamentación</h3>
            {inf.fundamentacion.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        )}

        <Firma inf={inf} />
      </>
    ),
  });

  /* ── Competencias ───────────────────────────────────────────────────
     Un velocímetro por competencia, ordenados de mayor a menor: así la
     pregunta "en qué es fuerte y en qué no" se contesta mirando. Cada anillo
     lleva marcados los cortes de las bandas, que le dan sentido al número. */
  const ordenadas = inf.competencias.slice().sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1));

  secciones.push({
    id: 'competencias',
    titulo: 'Competencias evaluadas',
    cuerpo:
      inf.competencias.length === 0 ? (
        <p className="sitio-vacio">Sin sumario cargado no se pueden calcular las competencias.</p>
      ) : (
        <>
          {inf.protocoloCorto && (
            <p className="sitio-aviso">
              Las competencias que salen del test de manchas van sin puntaje: {inf.protocoloCorto}.
            </p>
          )}

          {/* Los velocímetros del documento: son lo que el cliente reconoce del
              informe impreso, y la descarga sale de esta misma sección. */}
          <RadarCompetencias competencias={inf.competencias} exigencia={inf.exigencia} />

          <div className="inf-competencias">
            {ordenadas.map((c) => (
              <article key={c.nombre} className="inf-competencia">
                <Velocimetro puntaje={c.puntaje} exigencia={inf.exigencia} />
                <h3>{c.nombre}</h3>
                {c.puntaje !== null && (
                  <span className="inf-banda-texto" style={{ color: tono(c.puntaje, 1, inf.exigencia) }}>
                    {bandaDe(c.puntaje, inf.exigencia)}
                  </span>
                )}
                <p className="inf-mide">{c.mide}</p>
              </article>
            ))}
          </div>

          <EscalaBandas exigencia={inf.exigencia} />
        </>
      ),
  });

  /* ── Cómo trabaja ───────────────────────────────────────────────────
     Los tres grupos del análisis, cada uno en su bloque: lo que sobresale, lo
     que está en lo esperado y lo que conviene acompañar. */
  const grupos = [
    {
      clave: 'destacado',
      lista: 'destacadas' as const,
      titulo: 'Desarrollo destacado',
      sub: 'Por encima del rango esperado',
      items: inf.analisis.destacadas,
    },
    {
      clave: 'esperado',
      lista: 'esperadas' as const,
      titulo: 'Desarrollo esperado',
      sub: 'Dentro del rango esperado',
      items: inf.analisis.esperadas,
    },
    {
      clave: 'desarrollar',
      lista: 'desarrollar' as const,
      titulo: 'Necesidad de desarrollo',
      sub: 'Fuera del rango esperado: conviene acompañar',
      items: inf.analisis.desarrollar,
    },
  ];
  secciones.push({
    id: 'trabajo',
    titulo: 'Análisis cualitativo de las competencias',
    /* Cada grupo lo dibuja `Listas`: su recuadro, su título en el color de la
       banda, sus viñetas del mismo color y, en la ficha, el botón de editar y
       el índice que respalda cada oración. Es el mismo componente que dibuja el
       documento, así que las dos pantallas no se pueden separar. */
    cuerpo: (
      <div className="sitio-grupos">
        {/* Un grupo sin ítems no sale: un título con "no posee" abajo ocupa
            lugar sin decir nada. `Listas` lo resuelve, y en la ficha deja un
            botón para cargarle algo. */}
        {grupos.map((g) => (
          <Listas
            key={g.clave}
            id={editar}
            lista={g.lista}
            items={g.items}
            intervenida={inf.intervenidas.includes(g.lista)}
            vacio={`No posee características con ${g.titulo.toLowerCase()}.`}
            respaldos={editar ? inf.respaldos : undefined}
            origen={inf.proyectivo ?? undefined}
            grupo={{ clave: g.clave, titulo: g.titulo, sub: g.sub }}
          />
        ))}
      </div>
    ),
  });

  /* ── Cómo piensa ────────────────────────────────────────────────────── */
  if (inf.benziger) {
    secciones.push({
      id: 'pensamiento',
      titulo: 'Estilos de pensamiento predominantes',
      bajada: 'Según BTSA (Benziger Thinking Styles Assessment)',
      cuerpo: (
        <>
          <div className="inf-referencia-perfil">
            <span className="inf-ref adulto">Perfil adulto</span>
            <span className="inf-ref joven">Perfil adolescente</span>
          </div>
          <div className="inf-benziger sitio-benziger">
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
          {/* Un solo cuadrante, el primero que marcó la evaluadora, y solo
              lo que dice de la persona: cómo conducirla va en el plan de
              incorporación. */}
          {inf.benziger.preferentes[0] && inf.benziger.textos && (
            <EditarBenziger id={editar} parrafos={inf.benziger.parrafos} editado={inf.benziger.editado}>
            <div className="sitio-preferente">
              <h3 className="sitio-sub inf-predominante">
                Cuadrante predominante · {inf.benziger.preferentes[0].nombre}
              </h3>
              <p>
                {parrafoBenziger(inf.benziger, 'comoEs')}
                {editar && (
                  <span className="inf-respaldo inf-origen">
                    {inf.benziger.editado.comoEs ? 'Benziger · reescrito' : inf.benziger.textos.comoEsFuente}
                  </span>
                )}
              </p>
              {/* Fortaleza, debilidad y entorno: el mismo componente que el
                  documento clásico. */}
              <BenzigerLecturas inf={inf} editar={editar} rotulo="sitio-sub" />
            </div>
            </EditarBenziger>
          )}
        </>
      ),
    });
  }

  /* ── Hasta dónde puede llegar ───────────────────────────────────────── */
  if (inf.discursivo) {
    secciones.push({
      id: 'potencial',
      titulo: 'Potencial de desarrollo',
      bajada: 'Según análisis discursivo (modelo de Elliot Jaques)',
      cuerpo: <Escalera inf={inf} />,
    });
  }

  /* ── Plan de incorporación ──────────────────────────────────────────────────
     Después de todo lo que sostiene la decisión: es lo que el líder necesita
     si la persona entra, un agregado y no un fundamento. */
  secciones.push({
    id: 'lider',
    titulo: 'Plan de incorporación',
    bajada: 'Primeros 90 días, para su líder, en caso de que la persona ingrese',
    cuerpo: (
      <>
        <Listas
          id={editar}
          lista="recomendaciones"
          items={inf.recomendaciones.map((r) => r.texto)}
          tramos={inf.recomendaciones.map((r) => r.tramo)}
          intervenida={inf.intervenidas.includes('recomendaciones')}
          vacio="No surgen indicadores fuera de los rangos esperados que requieran una gestión particular."
          respaldos={editar ? inf.respaldos : undefined}
          origen={inf.proyectivo ?? undefined}
        />
        {/* Del Benziger, por tema y para toda la relación: va separado de
            las recomendaciones de las manchas, que van por tramo. */}
        {inf.benziger?.textos && inf.benziger.textos.conducir.length > 0 && (
          <>
            <h3 className="sitio-sub">Cómo conducir a esta persona</h3>
            <dl className="inf-conducir">
              {inf.benziger.textos.conducir.map((c) => (
                <div key={c.rotulo}>
                  <dt>{c.rotulo}</dt>
                  <dd>
                    {c.texto}
                    {editar && <span className="inf-respaldo inf-origen">{c.fuente}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </>
    ),
  });

  /* ── Técnicas ───────────────────────────────────────────────────────
     Con qué se la evaluó. Es su propia sección y va antes de los números: se
     lee de corrido con el resto del informe, mientras que los valores crudos
     se consultan cuando alguien los busca. */
  secciones.push({
    id: 'tecnicas',
    titulo: 'Técnicas de evaluación utilizadas',
    cuerpo: (
      <ul className="sitio-lista">
        {inf.tecnicas.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    ),
  });

  /* ── Indicadores ────────────────────────────────────────────────────
     Plegados. Son el respaldo de todo lo que el informe afirma y tienen que
     estar, pero desplegados son tres pantallas de tablas antes de terminar de
     leer: quien los quiere, los abre. */
  secciones.push({
    id: 'datos',
    titulo: 'Indicadores',
    bajada: 'Los valores medidos, sin interpretación',
    cuerpo: (
      <details className="sitio-desplegable">
        <summary>Cómo se calculó: ver todos los valores</summary>
        <div className="sitio-crudo">
          <Crudo inf={inf} />
          {/* De dónde sale cada puntaje: es del equipo y no del cliente, así
              que va solo en la ficha, y adentro de este mismo desplegable. */}
          {editar && <Desglose inf={inf} suelto />}
        </div>
      </details>
    ),
  });

  return secciones;
}
