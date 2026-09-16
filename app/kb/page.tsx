import Link from 'next/link';
import { listarKb, type Doc } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Knowledge base',
  robots: { index: false, follow: false },
};

/**
 * La base de conocimiento: lo que sabemos, para armar una charla sin volver a
 * escribirla.
 *
 * Los temas son lo que se explica y los ejercicios lo que hace la sala. Los
 * ejercicios viven aparte porque se usan en varios temas: una meditación no es
 * de mindfulness ni de conversaciones difíciles, se usa en las dos.
 */
function Tabla({ docs, columnas }: { docs: Doc[]; columnas: { rotulo: string; dato: string }[] }) {
  return (
    <div className="card pres-tabla kb-tabla">
      <div className="pres-row pres-th">
        <span>Qué es</span>
        {columnas.map((c) => (
          <span key={c.rotulo}>{c.rotulo}</span>
        ))}
      </div>
      {docs.map((d) => (
        <div className="pres-row" key={d.ruta}>
          <span className="pres-charla">
            <Link className="pres-entrar" href={`/kb/${d.ruta}`}>
              {d.titulo}
            </Link>
          </span>
          {columnas.map((c) => (
            <span key={c.rotulo}>{d.meta?.[c.dato] ?? '—'}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function Kb() {
  const docs = await listarKb();
  const de = (clase: Doc['clase']) => docs.filter((d) => d.clase === clase);
  const sueltos = de('suelto').filter((d) => d.ruta !== 'LEEME');

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Lo que sabemos, escrito</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Knowledge base</h1>
      </section>

      {docs.length === 0 ? (
        <p className="precios-nota">
          Todavía no hay nada cargado. Se sube con <code>node scripts/kb-sync.mjs</code>.
        </p>
      ) : (
        <>
          <section className="presentaciones">
            <h2 className="pres-ciclo">Temas</h2>
            <Tabla
              docs={de('tema')}
              columnas={[
                { rotulo: 'Qué cubre', dato: 'cubre' },
                { rotulo: 'Dictado', dato: 'dictado' },
              ]}
            />
          </section>

          <section className="presentaciones">
            <h2 className="pres-ciclo">Ejercicios</h2>
            <Tabla
              docs={de('ejercicio')}
              columnas={[
                { rotulo: 'Dura', dato: 'duracion' },
                { rotulo: 'Necesita', dato: 'necesita' },
              ]}
            />
          </section>

          <section className="presentaciones">
            <h2 className="pres-ciclo">Armados</h2>
            <Tabla
              docs={de('armado')}
              columnas={[
                { rotulo: 'Dura', dato: 'duracion' },
                { rotulo: 'Público', dato: 'publico' },
              ]}
            />
          </section>

          <section className="presentaciones">
            <h2 className="pres-ciclo">Para todos los temas</h2>
            <div className="card pres-tabla kb-tabla kb-tabla-sola">
              {sueltos.map((d) => (
                <div className="pres-row" key={d.ruta}>
                  <span className="pres-charla">
                    <Link className="pres-entrar" href={`/kb/${d.ruta}`}>
                      {d.titulo}
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
