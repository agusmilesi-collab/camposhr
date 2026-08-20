import Shell from '../../Shell';
import { FormCandidato, FormPedido } from './Formularios';
import { baterias, empresas, evaluadoras, pedidosAbiertos } from '@/lib/altas';
import { quienSoy } from '@/lib/identidad';

export const dynamic = 'force-dynamic';

/**
 * Cargar trabajo a mano.
 *
 * El portal del cliente ya deja cargar una solicitud, pero no todos los
 * clientes lo usan: varios mandan un mail y lo carga una psicóloga. Esta
 * pantalla es esa segunda puerta, y termina en la misma fila que la primera.
 */
export default async function Cargar() {
  const [yo, listaEmpresas, listaBaterias, listaPedidos, listaEvaluadoras] =
    await Promise.all([
      quienSoy(),
      empresas(),
      baterias(),
      pedidosAbiertos(),
      evaluadoras(),
    ]);

  return (
    <Shell titulo="Psicotécnicos · Cargar" identidad={yo.nombre}>
      <div className="os-encabezado">
        <h1>Cargar a mano</h1>
      </div>

      <div className="os-rejilla os-rejilla-pareja">
        <section className="os-panel">
          <div className="os-panel-top">
            <h2>Un pedido nuevo</h2>
          </div>
          <div className="os-panel-cuerpo">
            <FormPedido empresas={listaEmpresas} baterias={listaBaterias} />
          </div>
        </section>

        <section className="os-panel">
          <div className="os-panel-top">
            <h2>Un candidato</h2>
          </div>
          <div className="os-panel-cuerpo">
            <FormCandidato pedidos={listaPedidos} evaluadoras={listaEvaluadoras} />
          </div>
        </section>
      </div>

      <div className="os-aviso" style={{ marginTop: 20 }}>
        Lo que se carga acá se guarda en Supabase. Los pedidos y los candidatos
        que todavía viven en Airtable se siguen cargando desde sus interfaces
        hasta que se muden.
      </div>
    </Shell>
  );
}
