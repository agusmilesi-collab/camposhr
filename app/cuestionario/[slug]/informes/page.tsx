import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarRespuestas } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { GENERACIONES, INFO_GENERACION, type Generacion } from '@/lib/generaciones';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Informes — Campos HR',
  robots: { index: false, follow: false },
};

/** Cuenta cuántas veces aparece cada clave. */
function contar<T extends string>(claves: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const k of claves) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

export default async function Informes({
  params,
}: {
  params: { slug: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  // El cuestionario mixto es el que trae líder y generación.
  const respuestas = await listarRespuestas(empresa.id, 'generaciones');

  const porCuadrante = contar(
    respuestas.map((r) => r.perfiles?.[0]).filter(Boolean) as Perfil[]
  );

  // Una persona puede empatar en varias generaciones; se cuenta en cada una.
  const porGeneracion = contar(
    respuestas.flatMap((r) =>
      (r.generacion ?? '')
        .split('/')
        .map((corto) =>
          GENERACIONES.find((g) => INFO_GENERACION[g].corto === corto)
        )
        .filter(Boolean) as Generacion[]
    )
  );

  // Un bloque por equipo, ordenado de mayor a menor.
  const equipos = new Map<string, typeof respuestas>();
  for (const r of respuestas) {
    const nombre = r.lider_nombre ?? 'Sin líder asignado';
    if (!equipos.has(nombre)) equipos.set(nombre, []);
    equipos.get(nombre)!.push(r);
  }
  const orden = [...equipos.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  );

  const porcentaje = (n: number) =>
    respuestas.length ? Math.round((n / respuestas.length) * 100) : 0;

  return (
    <main className="wrap wrap-matriz">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Informes · cuestionario mixto</div>
          <a href="/cuestionario" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Empresas
          </a>
        </div>
        <h1>{empresa.nombre}</h1>
      </section>

      {respuestas.length === 0 ? (
        <section className="accesos">
          <p className="empty">
            Todavía no hay respuestas del cuestionario mixto para esta empresa.
          </p>
        </section>
      ) : (
        <>
          <section className="inf-resumen">
            <div className="inf-caja">
              <h2>Perfil predominante</h2>
              <ul className="inf-barras">
                {PERFILES.map((p) => {
                  const n = porCuadrante.get(p) ?? 0;
                  return (
                    <li key={p}>
                      <span className="inf-etiqueta">{INFO[p].nombre}</span>
                      <span className="inf-barra">
                        <span style={{ width: `${porcentaje(n)}%` }} />
                      </span>
                      <span className="inf-valor">
                        {n} · {porcentaje(n)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="inf-caja">
              <h2>Estilo generacional</h2>
              <ul className="inf-barras">
                {GENERACIONES.map((g) => {
                  const n = porGeneracion.get(g) ?? 0;
                  return (
                    <li key={g}>
                      <span className="inf-etiqueta">{INFO_GENERACION[g].nombre}</span>
                      <span className="inf-barra">
                        <span style={{ width: `${porcentaje(n)}%` }} />
                      </span>
                      <span className="inf-valor">
                        {n} · {porcentaje(n)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="inf-nota">
                Quien empata entre varias generaciones se cuenta en cada una.
              </p>
            </div>
          </section>

          <section className="inf-equipos">
            <div className="inf-equipos-top">
              <h2>Por equipo</h2>
              <a className="btn-ghost" href={`/cuestionario/${empresa.slug}/export`}>
                Descargar CSV
              </a>
            </div>

            <div className="card">
              <div className="inf-row inf-th">
                <span>Líder</span>
                <span>Personas</span>
                <span>Perfiles</span>
                <span>Generaciones</span>
              </div>
              {orden.map(([lider, gente]) => {
                const perfiles = contar(
                  gente.map((r) => r.perfiles?.[0]).filter(Boolean) as Perfil[]
                );
                const generaciones = contar(
                  gente.flatMap((r) => (r.generacion ?? '').split('/').filter(Boolean))
                );
                return (
                  <div className="inf-row" key={lider}>
                    <span className="acc-name">{lider}</span>
                    <span className="inf-num">{gente.length}</span>
                    <span className="inf-mix">
                      {PERFILES.filter((p) => perfiles.get(p))
                        .map((p) => `${p} ${perfiles.get(p)}`)
                        .join(' · ')}
                    </span>
                    <span className="inf-mix">
                      {[...generaciones.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([g, n]) => `${g} ${n}`)
                        .join(' · ')}
                    </span>
                    <span className="inf-gente">
                      {gente
                        .slice()
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map((r) => (
                          <a
                            key={r.id}
                            className="inf-persona"
                            href={`/cuestionario/${empresa.slug}/informes/${r.id}`}
                          >
                            {r.nombre}
                          </a>
                        ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
