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
    <main className="wrap">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Cuestionario de perfil</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Empresas</h1>
        <p className="head-nota">
          Un QR por empresa para que el equipo responda desde el celular, y la
          matriz en vivo para proyectar durante el encuentro.
        </p>
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
                  <a
                    className="btn-ghost"
                    href={`/cuestionario/${e.slug}/qr`}
                    title="QR del cuestionario de perfil"
                  >
                    QR perfil
                  </a>
                  <a
                    className="btn-ghost"
                    href={`/cuestionario/${e.slug}/qr?v=g`}
                    title="QR de la versión con generaciones y líder"
                  >
                    QR generaciones
                  </a>
                  <a
                    className="btn-ghost"
                    href={`/cuestionario/${e.slug}/export`}
                    title="Descargar respuestas en CSV"
                  >
                    CSV
                  </a>
                  <a className="btn" href={`/cuestionario/${e.slug}/matriz`}>
                    Ver matriz
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
