import { listarClientes } from '@/lib/clients';
import { getNombresEmpresas } from '@/lib/airtable';
import CopyLink from './CopyLink';

export const dynamic = 'force-dynamic';

const BASE_PORTAL = 'https://clientes.camposhr.com';

export default async function Informes() {
  const clientes = listarClientes();
  const nombres = await getNombresEmpresas(clientes.map((c) => c.empresaId));

  const filas = clientes
    .map((c) => ({
      nombre: nombres.get(c.empresaId) ?? 'Cliente',
      token: c.token,
      url: `${BASE_PORTAL}/${c.token}`,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <main className="wrap">
      <section className="head">
        <div className="eyebrow">Accesos de clientes</div>
        <h1>Links de portal</h1>
        <p className="head-nota">
          El link de cada cliente para seguir el estado de sus evaluaciones.
          Copialo y envialo por el canal acordado.
        </p>
      </section>

      <section className="accesos">
        {filas.length === 0 ? (
          <p className="empty">Todavía no hay clientes con acceso configurado.</p>
        ) : (
          <div className="card">
            <div className="acc-row acc-th">
              <span>Cliente</span>
              <span>Link de acceso</span>
              <span />
            </div>
            {filas.map((f) => (
              <div className="acc-row" key={f.token}>
                <span className="acc-name">{f.nombre}</span>
                <a
                  className="acc-url"
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.url.replace(/^https:\/\//, '')}
                </a>
                <CopyLink url={f.url} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
