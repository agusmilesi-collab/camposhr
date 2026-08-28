import type { Informe } from '@/lib/informe';
import { bandaDe } from '@/lib/exigencia';
import { CONFIDENCIALIDAD, CUADRANTES, FIRMAS, NIVELES } from '@/lib/informe-textos';
import {
  EscalaBandas,
  IconoNivel,
  Velocimetro,
  tono,
} from '@/app/os/psicotecnicos/informe/_doc/piezas';
import Cerebro from '@/app/os/psicotecnicos/informe/_doc/Cerebro';
import Crudo from '@/app/os/psicotecnicos/informe/_doc/Crudo';
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

export type Seccion = {
  /** El ancla de la dirección y el destino del índice. */
  id: string;
  /** Cómo se llama en el índice. */
  titulo: string;
  /** Una línea que dice qué se contesta ahí. */
  bajada?: string;
  cuerpo: React.ReactNode;
};

export function seccionesDe(inf: Informe): Seccion[] {
  const firma = inf.evaluadora ? FIRMAS[inf.evaluadora] : undefined;
  const secciones: Seccion[] = [];

  /* ── Recomendación ──────────────────────────────────────────────────
     Lo primero y lo único que hace falta para decidir: qué se recomienda, por
     qué, y quién lo firma. Los otros tres niveles se muestran apagados porque
     el semáforo se lee comparando: sin ellos, "ajuste alto" no dice contra
     qué. */
  secciones.push({
    id: 'recomendacion',
    titulo: 'Recomendación',
    bajada: 'Qué se recomienda y por qué.',
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

        {inf.fundamentacion.length > 0 && (
          <>
            <h3 className="sitio-sub">Por qué esa recomendación</h3>
            {inf.fundamentacion.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </>
        )}

        <div className="sitio-firma">
          <div>
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
      </>
    ),
  });

  /* ── Competencias ───────────────────────────────────────────────────── */
  secciones.push({
    id: 'competencias',
    titulo: 'Competencias',
    bajada: 'Cómo dio en cada una de las nueve.',
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
          <div className="inf-competencias sitio-competencias">
            {inf.competencias.map((c) => (
              <article key={c.nombre} className="inf-competencia">
                <Velocimetro puntaje={c.puntaje} exigencia={inf.exigencia} />
                <h3>{c.nombre}</h3>
                {c.puntaje !== null && (
                  <span
                    className="inf-banda-texto"
                    style={{ color: tono(c.puntaje, 1, inf.exigencia) }}
                  >
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
      titulo: 'Lo que se destaca',
      sub: 'Por encima del rango esperado',
      items: inf.analisis.destacadas,
    },
    {
      clave: 'esperado',
      titulo: 'Lo que está en lo esperado',
      sub: 'Dentro del rango esperado',
      items: inf.analisis.esperadas,
    },
    {
      clave: 'desarrollar',
      titulo: 'Lo que conviene acompañar',
      sub: 'Fuera del rango esperado',
      items: inf.analisis.desarrollar,
    },
  ];
  secciones.push({
    id: 'trabajo',
    titulo: 'Cómo trabaja',
    bajada: 'Qué se destaca, qué está en lo esperado y qué conviene acompañar.',
    cuerpo: (
      <div className="sitio-grupos">
        {grupos.map((g) => (
          <section key={g.clave} className={`sitio-grupo ${g.clave}`}>
            <header>
              <h3>{g.titulo}</h3>
              <span>{g.sub}</span>
            </header>
            {g.items.length === 0 ? (
              <p className="sitio-vacio">Sin registros en este grupo.</p>
            ) : (
              <ul>
                {g.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    ),
  });

  /* ── Para su líder ──────────────────────────────────────────────────── */
  secciones.push({
    id: 'lider',
    titulo: 'Para su líder',
    bajada: 'Qué hacer para que rinda.',
    cuerpo:
      inf.recomendaciones.length === 0 ? (
        <p className="sitio-vacio">
          No surgen indicadores fuera de los rangos esperados que requieran una gestión
          particular.
        </p>
      ) : (
        <ol className="sitio-lider">
          {inf.recomendaciones.map((t, i) => (
            <li key={t}>
              <span className="sitio-orden">{i + 1}</span>
              <p>{t}</p>
            </li>
          ))}
        </ol>
      ),
  });

  /* ── Cómo piensa ────────────────────────────────────────────────────── */
  if (inf.benziger) {
    secciones.push({
      id: 'pensamiento',
      titulo: 'Cómo piensa',
      bajada: 'Con qué parte del cerebro trabaja cómoda.',
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
      titulo: 'Hasta dónde puede llegar',
      bajada: 'Qué tamaño de trabajo puede manejar, hoy y más adelante.',
      cuerpo: <Escalera inf={inf} />,
    });
  }

  /* ── Los datos ──────────────────────────────────────────────────────── */
  secciones.push({
    id: 'datos',
    titulo: 'Los datos',
    bajada: 'Los valores medidos, sin interpretar.',
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
