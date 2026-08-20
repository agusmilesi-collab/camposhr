import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import CopyLink from '@/app/informes/CopyLink';
import { listarClientesConToken } from '@/lib/airtable';
import { NOMBRE_DEMO, TOKEN_DEMO } from '@/lib/portal-demo';

export const dynamic = 'force-dynamic';

const PORTAL = 'https://clientes.camposhr.com';

/**
 * El enlace de portal de cada cliente, listo para copiar.
 *
 * El alta no se hace acá: se hace llenando el campo "Token portal" de la
 * empresa en Airtable, y el cliente aparece en esta lista solo.
 */
export default async function Accesos() {
  const yo = await quienSoy();
  const clientes = await listarClientesConToken();

  const filas = clientes
    .map((c) => ({ nombre: c.nombre, url: `${PORTAL}/${c.token}`, prueba: false }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // El cliente de prueba va último y con su sello: es donde se mira una
  // pantalla antes de mostrársela a un cliente de verdad.
  filas.push({ nombre: NOMBRE_DEMO, url: `${PORTAL}/${TOKEN_DEMO}`, prueba: true });

  return (
    <Shell identidad={yo.nombre} titulo="Accesos" nota={`${clientes.length} portales`}>
      <div className="os-encabezado">
        <h1>El enlace de cada cliente</h1>
        <p>
          Quien tiene el enlace entra: es el secreto que da acceso. Se manda por
          el canal acordado con el cliente y no se publica en ningún lado.
        </p>
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Portales</h2>
        </div>
        {filas.map((f) => (
          <div className="os-fila" key={f.url}>
            <div className="os-fila-cuerpo">
              <div className="os-fila-titulo">
                {f.nombre}
                {f.prueba && (
                  <span className="os-etiqueta" style={{ marginLeft: 8 }}>
                    prueba
                  </span>
                )}
              </div>
              <div className="os-fila-detalle" style={{ wordBreak: 'break-all' }}>
                {f.url}
              </div>
            </div>
            <div className="os-fila-lado" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <a href={f.url} target="_blank" rel="noreferrer">
                Abrir
              </a>
              <CopyLink url={f.url} texto="Copiar enlace" />
            </div>
          </div>
        ))}
      </section>
    </Shell>
  );
}
