import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import { select } from '@/lib/supabase';
import { NOMBRE_DEMO, TOKEN_DEMO } from '@/lib/portal-demo';
import CopyLink from './CopyLink';

export const dynamic = 'force-dynamic';

const BASE_PORTAL = 'https://clientes.camposhr.com';

export default async function Informes() {
  // Los enlaces vigentes de cada empresa. La de prueba va aparte, abajo, con su
  // enlace propio; la muestra pública no es un cliente.
  const clientes = (
    await select<{ nombre: string; token: string | null }>(
      'empresas',
      'select=nombre,token:token_portal&token_portal=not.is.null&order=nombre.asc'
    ).catch(() => [])
  ).filter(
    (c): c is { nombre: string; token: string } =>
      Boolean(c.token) && !esEmpresaEjemplo(c.nombre) && !c.nombre.startsWith(NOMBRE_DEMO)
  );

  const filas = clientes
    .map((c) => ({
      nombre: c.nombre,
      token: c.token,
      url: `${BASE_PORTAL}/${c.token}`,
      prueba: false,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // El cliente de prueba se lista junto a los reales, acá y en el sitio
  // desplegado: es donde se mira cómo quedó una pantalla antes de mostrársela a
  // un cliente. Va último y con su sello, que alcanza para no confundirlo con
  // una empresa.
  if (TOKEN_DEMO) filas.push({
    nombre: NOMBRE_DEMO,
    token: TOKEN_DEMO,
    url: `${BASE_PORTAL}/${TOKEN_DEMO}`,
    prueba: true,
  });

  return (
    <main className="wrap">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Accesos de clientes</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Links de portal</h1>
        <p className="head-nota">
          Cada cliente entra por su propio link al estado de sus evaluaciones.
          Ingresar lo abre acá; Copiar link lo deja listo para mandarlo por el
          canal acordado.
        </p>
      </section>

      <section className="accesos">
        {filas.length === 0 ? (
          <p className="empty">Todavía no hay clientes con acceso configurado.</p>
        ) : (
          <div className="card">
            <div className="acc-row acc-th">
              <span>Cliente</span>
              <span />
            </div>
            {filas.map((f) => (
              <div className="acc-row" key={f.token}>
                <span className="acc-name">
                  <span className="acc-name-txt">{f.nombre}</span>
                  {f.prueba && <span className="acc-tag">prueba</span>}
                </span>
                <span className="acc-acciones">
                  <a
                    className="acc-entrar"
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ingresar
                  </a>
                  <CopyLink url={f.url} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
