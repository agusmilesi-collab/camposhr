import Shell from '../Shell';
import Cards from './Cards';
import { listarClientes } from '@/lib/clientes';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const dynamic = 'force-dynamic';

export default async function Clientes() {
  const [yo, clientes] = await Promise.all([quienSoy(), listarClientes()]);

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell
      titulo="Clientes"
      identidad={yo.nombre}
      ancho
      nota={`${clientes.length} clientes`}
      cuentas={{ ...cuentas, '/os/clientes': clientes.length }}
    >
      <div className="os-encabezado">
        <h1>Clientes</h1>
      </div>

      <Cards clientes={clientes} />
    </Shell>
  );
}
