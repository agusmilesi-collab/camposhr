import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { NORMAS_VERSION } from '@/lib/centro-acceso';
import Barra from '../Barra';
import HojaNormas from '../normas/Hoja';
import Aceptar from '../normas/Aceptar';
import { SECCIONES } from '../manual/contenido';

export const dynamic = 'force-dynamic';

/**
 * Documentos: las normas de convivencia y el manual del sistema, en una sola
 * pantalla con dos pestañas, como Mi cuenta. Son lo que se lee y no lo que se
 * opera, y vivían como dos entradas de la barra para la misma pregunta.
 *
 * Las normas traen al pie el botón de aceptar mientras falte la versión
 * vigente. /centro/normas y /centro/manual siguen existiendo y llegan acá.
 */
export default async function Documentos(props: { searchParams: Promise<{ ver?: string }> }) {
  const searchParams = await props.searchParams;
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');
  const vista: 'normas' | 'manual' = searchParams.ver === 'manual' ? 'manual' : 'normas';

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/documentos" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Documentos</h1>

        <nav className="centro-pestanas">
          <a className={vista === 'normas' ? 'activa' : undefined} href="/centro/documentos?ver=normas">
            Normas
          </a>
          <a className={vista === 'manual' ? 'activa' : undefined} href="/centro/documentos?ver=manual">
            Manual
          </a>
        </nav>

        {vista === 'normas' ? (
          <HojaNormas
            pie={
              yo.normas_version !== NORMAS_VERSION ? (
                <Aceptar actualizadas={yo.normas_aceptadas_at !== null} />
              ) : undefined
            }
          />
        ) : (
          <>
            <nav className="centro-manual-indice" aria-label="Secciones del manual">
              {SECCIONES.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {s.titulo}
                </a>
              ))}
            </nav>
            {SECCIONES.map((s) => (
              <section key={s.id} id={s.id} className="centro-panel centro-manual-seccion">
                <h2>{s.titulo}</h2>
                {s.parrafos.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {s.capturas?.map((c) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={c.archivo}
                    className="centro-manual-captura"
                    src={`/centro/manual/${c.archivo}`}
                    alt={c.alt}
                    title={c.alt}
                    loading="lazy"
                    style={c.ancho ? { maxWidth: c.ancho } : undefined}
                  />
                ))}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
