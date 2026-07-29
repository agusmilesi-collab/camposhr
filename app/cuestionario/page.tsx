import { contarRespuestas, listarEmpresas } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuestionario de Perfil — Campos HR',
  robots: { index: false, follow: false },
};

export default async function IndiceCuestionario() {
  const empresas = await listarEmpresas();
  const conteos = await Promise.all(empresas.map((e) => contarRespuestas(e.id)));

  return (
    <main className="wrap wrap-matriz">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Cuestionario de perfil</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Empresas</h1>
      </section>

      <section className="accesos">
        {empresas.length === 0 ? (
          <p className="empty">
            Todavía no hay empresas cargadas. Se agregan en la tabla{' '}
            <code>empresas</code> de Supabase.
          </p>
        ) : (
          <div className="card">
            <div className="cu-row cu-th">
              <span>Empresa</span>
              <span>Respuestas</span>
              <span />
            </div>
            {empresas.map((e, i) => (
              <div className="cu-row" key={e.id}>
                <span className="acc-name">{e.nombre}</span>
                <span className="cu-conteo">
                  {conteos[i]} {conteos[i] === 1 ? 'persona' : 'personas'}
                </span>
                <span className="cu-acciones">
                  {/* Cada cuestionario con su pantalla: el de perfil se mira
                      en la matriz, el de liderazgo en los informes. */}
                  <span className="cu-grupo">
                    <a
                      className="btn-ghost"
                      href={`/cuestionario/${e.slug}/qr`}
                      title="QR del cuestionario de perfil (solo cuadrantes)"
                    >
                      QR Perfil
                    </a>
                    <a className="btn" href={`/cuestionario/${e.slug}/matriz`}>
                      Ver matriz
                    </a>
                  </span>

                  <span className="cu-sep" aria-hidden="true" />

                  <span className="cu-grupo">
                    <a
                      className="btn-ghost"
                      href={`/cuestionario/${e.slug}/qr?v=g`}
                      title="QR del cuestionario de liderazgo: cuadrantes, generaciones y líder"
                    >
                      QR Liderazgo
                    </a>
                    <a className="btn" href={`/cuestionario/${e.slug}/informes`}>
                      Ver informes
                    </a>
                  </span>

                  <span className="cu-sep" aria-hidden="true" />

                  <a
                    className="btn-ghost"
                    href={`/cuestionario/${e.slug}/export`}
                    title="Descargar todas las respuestas en CSV"
                  >
                    CSV
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
