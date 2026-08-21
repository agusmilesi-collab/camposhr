import Shell from '../Shell';
import NuevoCliente from './NuevoCliente';
import CopyLink from '@/app/informes/CopyLink';
import { listarClientes } from '@/lib/clientes';
import { quienSoy } from '@/lib/identidad';

export const dynamic = 'force-dynamic';

const PORTAL = 'https://clientes.camposhr.com';

/** Un valor que falta se ve como que falta, no como una celda vacía. */
function Dato({ valor }: { valor: string | number | null }) {
  if (valor === null || valor === '') return <span className="os-tabla-flojo">—</span>;
  return <>{valor}</>;
}

export default async function Clientes() {
  const [yo, clientes] = await Promise.all([quienSoy(), listarClientes()]);

  const sinDatos = clientes.filter((c) => !c.cuit).length;

  return (
    <Shell
      titulo="Clientes"
      identidad={yo.nombre}
      ancho
      nota={`${clientes.length} clientes`}
      cuentas={{ '/os/clientes': clientes.length }}
    >
      <div className="os-encabezado">
        <h1>Los clientes</h1>
        <p>
          Con lo que hace falta para facturarles y para llamarlos. Los que
          todavía viven en Airtable aparecen marcados y sin sus datos: se
          completan cargándolos acá.
        </p>
      </div>

      <div className="os-barra-acciones">
        <NuevoCliente />
        {sinDatos > 0 && (
          <span className="os-columna-nota" style={{ alignSelf: 'center' }}>
            {sinDatos} sin CUIT cargado.
          </span>
        )}
      </div>

      <section className="os-panel">
        <div className="os-tabla-marco">
          <table className="os-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Razón social</th>
                <th>CUIT</th>
                <th>IVA</th>
                <th>Contacto</th>
                <th>Rubro</th>
                <th className="os-tabla-num">Personas</th>
                <th className="os-tabla-num">Pedidos</th>
                <th className="os-tabla-num">Evaluaciones</th>
                <th className="os-tabla-num">Cotizaciones</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id ?? c.nombre}>
                  <td>
                    <div className="os-tabla-nombre">{c.nombre}</div>
                    {c.origen === 'airtable' && (
                      <div className="os-etiquetas">
                        <span className="os-etiqueta">Airtable</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <Dato valor={c.razonSocial} />
                  </td>
                  <td>
                    <Dato valor={c.cuit} />
                  </td>
                  <td>
                    <Dato valor={c.condicionIva} />
                  </td>
                  <td>
                    <Dato valor={c.contacto ?? c.emailFacturacion} />
                  </td>
                  <td>
                    <Dato valor={c.rubro} />
                  </td>
                  <td className="os-tabla-num">
                    <Dato valor={c.tamano} />
                  </td>
                  <td className="os-tabla-num">{c.pedidos || <span className="os-tabla-flojo">—</span>}</td>
                  <td className="os-tabla-num">
                    {c.evaluaciones || <span className="os-tabla-flojo">—</span>}
                  </td>
                  <td className="os-tabla-num">
                    {c.cotizaciones || <span className="os-tabla-flojo">—</span>}
                  </td>
                  {/* El enlace del portal es el secreto que da acceso: se
                      manda por el canal acordado y no se publica. Vive acá y no
                      en una pantalla aparte, que era la misma lista de clientes
                      con una sola columna. */}
                  <td>
                    {c.token ? (
                      <span className="os-portal-acciones">
                        <a
                          className="os-boton"
                          href={`${PORTAL}/${c.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
                        <CopyLink url={`${PORTAL}/${c.token}`} texto="Copiar enlace" />
                      </span>
                    ) : (
                      <span className="os-tabla-flojo">sin portal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientes.length === 0 && <p className="os-vacio">Todavía no hay clientes cargados.</p>}
      </section>
    </Shell>
  );
}
