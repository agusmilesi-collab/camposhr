import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Barra from '../Barra';
import { SECCIONES } from './contenido';

export const dynamic = 'force-dynamic';

/**
 * El manual: una pantalla con todo lo que el inquilino necesita saber para
 * usar el sistema, en el mismo lugar donde lo usa. Reemplaza al documento
 * aparte que había que mandar y volver a mandar cada vez que cambiaba algo.
 */
export default async function Manual() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/manual" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Manual</h1>
        <p className="centro-bajada">Cómo se usa el sistema de consultorios y qué reglas aplica.</p>

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
              />
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
