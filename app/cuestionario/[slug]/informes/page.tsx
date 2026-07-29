import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarLideres, listarRespuestas } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { GENERACIONES, INFO_GENERACION, type Generacion } from '@/lib/generaciones';
import CopiarEnlace from './CopiarEnlace';
import { claveOrden, nombreCompleto } from '@/lib/personas';

export const dynamic = 'force-dynamic';

/** Fecha corta de la respuesta: 14/11/25. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

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
  const [respuestas, lideres] = await Promise.all([
    listarRespuestas(empresa.id, 'generaciones'),
    listarLideres(empresa.id),
  ]);
  const tokenDe = new Map(lideres.map((l) => [l.nombre, l.token]));

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
  const orden = [...equipos.entries()].sort((a, b) => a[0].localeCompare(b[0]));

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

            {/* Un bloque por equipo: el líder abre su propia tabla. */}
            <div className="inf-bloques">
              {orden.map(([lider, gente]) => {
                const perfiles = contar(
                  gente.map((r) => r.perfiles?.[0]).filter(Boolean) as Perfil[]
                );
                const dominante = PERFILES.filter((p) => perfiles.get(p)).sort(
                  (a, b) => (perfiles.get(b) ?? 0) - (perfiles.get(a) ?? 0)
                )[0];

                return (
                  <section className="card inf-equipo" key={lider}>
                    <header className="inf-equipo-top">
                      <h3>{lider}</h3>
                      <span className="inf-equipo-meta">
                        {gente.length} {gente.length === 1 ? 'persona' : 'personas'}
                        {dominante && ` · mayoría ${INFO[dominante].nombre}`}
                      </span>
                      <CopiarEnlace token={tokenDe.get(lider) ?? null} />
                    </header>

                    <div className="inf-fila inf-th">
                      <span>Persona</span>
                      <span>Perfil</span>
                      <span className="inf-nums">FI</span>
                      <span className="inf-nums">FD</span>
                      <span className="inf-nums">BI</span>
                      <span className="inf-nums">BD</span>
                      <span>Generación</span>
                      <span>Fecha</span>
                      <span />
                    </div>

                    {gente
                      .slice()
                      .sort((a, b) => claveOrden(a).localeCompare(claveOrden(b)))
                      .map((r) => {
                        const totales = (r.totales ?? {}) as Record<string, number>;
                        const perfil = (r.perfiles?.[0] ?? '') as Perfil;
                        return (
                          <div className="inf-fila" key={r.id}>
                            <span className="acc-name">{nombreCompleto(r)}</span>
                            <span className="inf-perfil">
                              {perfil ? INFO[perfil].nombre : '—'}
                            </span>
                            {PERFILES.map((p) => (
                              <span
                                className={
                                  p === perfil ? 'inf-nums inf-nums-on' : 'inf-nums'
                                }
                                key={p}
                              >
                                {totales[p] ?? '—'}
                              </span>
                            ))}
                            <span className="inf-suave">{r.generacion ?? '—'}</span>
                            <span className="inf-suave">{fechaCorta(r.created_at)}</span>
                            <a
                              className="inf-ver"
                              href={`/cuestionario/${empresa.slug}/informes/${r.id}`}
                            >
                              Playbook
                            </a>
                          </div>
                        );
                      })}
                  </section>
                );
              })}
            </div>
          </section>

        </>
      )}
    </main>
  );
}
