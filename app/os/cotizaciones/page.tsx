import Shell from '../Shell';
import { NuevaOportunidad, Tablero } from './Embudo';
import ServiciosCamposHR from './ServiciosCamposHR';
import { listarCotizaciones } from '@/lib/cotizaciones';
import { quienSoy } from '@/lib/identidad';
import { listarClientes } from '@/lib/clientes';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const dynamic = 'force-dynamic';

export default async function Cotizaciones() {
  const [yo, todas, clientes] = await Promise.all([
    quienSoy(),
    listarCotizaciones(),
    listarClientes(),
  ]);

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell
      titulo="Cotizaciones"
      identidad={yo.nombre}
      nota={`${todas.length} oportunidades`}
      cuentas={cuentas}
    >
      <div className="os-encabezado">
        <h1>Servicios Campos HR</h1>
      </div>

      <div className="os-barra-acciones">
        <NuevaOportunidad clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </div>

      <Tablero
        oportunidades={todas.map((c) => ({
          id: c.id,
          cliente: c.cliente,
          empresaId: c.empresaId,
          concepto: c.concepto,
          importe: c.importe,
          moneda: c.moneda,
          estado: c.estado,
          fecha: c.fecha,
          token: c.token,
          nota: c.nota,
          motivo: c.motivo,
          objecion: c.objecion,
        }))}
        clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />

      <ServiciosCamposHR cotizaciones={todas} quien={yo.nombre} />
    </Shell>
  );
}
