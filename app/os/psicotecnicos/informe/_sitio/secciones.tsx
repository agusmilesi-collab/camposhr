import type { Informe } from '@/lib/informe';
import { bandaDe, bandasDe } from '@/lib/exigencia';
import { CONFIDENCIALIDAD, CUADRANTES, FIRMAS, NIVELES } from '@/lib/informe-textos';
import { firmaEnDatos } from '@/lib/firmas';
import Listas from '../_doc/Listas';
import { EscalaBandas, IconoNivel, tono } from '../_doc/piezas';
import Cerebro from '../_doc/Cerebro';
import Crudo from '../_doc/Crudo';
import Escalera from './Escalera';

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
  return (
    <div className="sitio-firma">
      <div>
        {trazo && <img className="sitio-trazo" src={trazo} alt="" />}
        <strong>{inf.evaluadora ?? 'Sin evaluadora asignada'}</strong>
        {firma && (
          <span>
            {firma.titulo} · Mat. {firma.matricula}
            {firma.correo ? ` · ${firma.correo}` : ''}
          </span>
        )}
      </div>
      <p className="sitio-confidencial">{CONFIDENCIALIDAD}</p>
    </div>
  );
}

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
  editar?: string
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
        <div className="sitio-semaforo">
          {NIVELES.map((nv) => {
            const elegido = inf.nivel?.clave === nv.clave;
            return (
              <article
                key={nv.clave}
                className={`sitio-nivel-ajuste ${nv.color}${elegido ? ' elegido' : ''}`}
                aria-current={elegido ? 'true' : undefined}
              >
                <IconoNivel clave={nv.clave} />
                <div>
                  <h3>{nv.titulo}</h3>
                  {elegido && <p>{nv.texto}</p>}
                </div>
              </article>
            );
          })}
        </div>

        <h3 className="sitio-sub">Qué dio la evaluación</h3>
        {inf.resumen.map((t, i) => (
          <p key={i}>{t}</p>
        ))}

        {/* Lo que escribió la evaluadora se destaca del resto: es la única
            parte del informe que dice "yo la entrevisté y esto me parece", y
            leerla al mismo cuerpo que lo que arma el motor la hace pasar por
            una conclusión más. */}
        {inf.fundamentacion.length > 0 && (
          <blockquote className="sitio-cita">
            <h3 className="sitio-cita-rotulo">Por qué esa recomendación</h3>
            {inf.fundamentacion.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            <footer>{inf.evaluadora}</footer>
          </blockquote>
        )}

        <Firma inf={inf} />
      </>
    ),
  });

  /* ── Competencias ───────────────────────────────────────────────────
     Nueve puntajes se comparan, no se leen de a uno: van en barras y ordenados
     de mayor a menor, así la pregunta "en qué es fuerte y en qué no" se
     contesta mirando y sin recorrer nueve números. La pista lleva marcados los
     cortes de las bandas, que son los que le dan sentido al número. */
  const ordenadas = inf.competencias
    .slice()
    .sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1));
  const cortes = bandasDe(inf.exigencia)
    .filter((b) => b.desde > 0)
    .map((b) => b.desde);

  secciones.push({
    id: 'competencias',
    titulo: 'Competencias evaluadas',
    cuerpo:
      inf.competencias.length === 0 ? (
        <p className="sitio-vacio">
          Sin sumario cargado no se pueden calcular las competencias.
        </p>
      ) : (
        <>
          {inf.protocoloCorto && (
            <p className="sitio-aviso">
              Las competencias que salen del test de manchas van sin puntaje:{' '}
              {inf.protocoloCorto}.
            </p>
          )}

          <div className="sitio-comps">
            {ordenadas.map((c) => (
              <article key={c.nombre} className="sitio-comp">
                <div className="sitio-comp-quien">
                  <h3>{c.nombre}</h3>
                  <p>{c.mide}</p>
                </div>
                <div className="sitio-comp-medida">
                  <div
                    className="sitio-pista"
                    /* Los cortes de las bandas, dibujados sobre la pista: sin
                       ellos el largo de la barra no dice en qué banda cayó. */
                    style={{
                      backgroundImage: cortes
                        .map(
                          (x) =>
                            `linear-gradient(90deg, transparent ${x}%, var(--linea) ${x}%, var(--linea) calc(${x}% + 1px), transparent calc(${x}% + 1px))`
                        )
                        .join(', '),
                    }}
                  >
                    {c.puntaje !== null && (
                      <span
                        className="sitio-relleno"
                        style={{
                          width: `${c.puntaje}%`,
                          background: tono(c.puntaje, 1, inf.exigencia),
                        }}
                      />
                    )}
                  </div>
                  <div className="sitio-comp-cifra">
                    {c.puntaje === null ? (
                      <span className="sitio-sin">sin datos</span>
                    ) : (
                      <>
                        <strong style={{ color: tono(c.puntaje, 1, inf.exigencia) }}>
                          {c.puntaje}
                        </strong>
                        <span>{bandaDe(c.puntaje, inf.exigencia)}</span>
                      </>
                    )}
                  </div>
                </div>
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
        {grupos.map((g) => (
          <Listas
            key={g.clave}
            id={editar}
            lista={g.lista}
            items={g.items}
            intervenida={inf.intervenidas.includes(g.lista)}
            vacio="Sin registros en este grupo."
            respaldos={editar ? inf.respaldos : undefined}
            grupo={{ clave: g.clave, titulo: g.titulo, sub: g.sub }}
          />
        ))}
      </div>
    ),
  });

  /* ── Para su líder ──────────────────────────────────────────────────── */
  secciones.push({
    id: 'lider',
    titulo: 'Recomendaciones para su líder directo',
    cuerpo: (
      <Listas
        id={editar}
        lista="recomendaciones"
        items={inf.recomendaciones}
        intervenida={inf.intervenidas.includes('recomendaciones')}
        numerada
        vacio="No surgen indicadores fuera de los rangos esperados que requieran una gestión particular."
        respaldos={editar ? inf.respaldos : undefined}
      />
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
                  className={
                    manda ? `inf-cuadrante ${q.clave} manda` : `inf-cuadrante ${q.clave}`
                  }
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
          {inf.benziger.preferentes.map((q) => (
            <div key={q.clave} className="sitio-preferente">
              <h3 className="sitio-sub">{q.nombre}</h3>
              <ul className="sitio-lista">
                {q.caracteristicas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="sitio-fuente">
            Sale del BZG Thinking Styles Assessment (BTSA), el cuestionario de perfil de
            pensamiento que administra el estudio bajo licencia.
          </p>
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

  /* ── Los datos ──────────────────────────────────────────────────────── */
  secciones.push({
    id: 'datos',
    titulo: 'Indicadores',
    bajada: 'Los valores medidos, sin interpretación',
    cuerpo: (
      <div className="sitio-crudo">
        <Crudo inf={inf} />
        <h3 className="sitio-sub">Técnicas de evaluación utilizadas</h3>
        <ul className="sitio-lista">
          {inf.tecnicas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    ),
  });

  return secciones;
}
