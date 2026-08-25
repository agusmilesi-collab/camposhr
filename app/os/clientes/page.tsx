import Shell from '../Shell';
import Cards from './Cards';
import { listarClientes } from '@/lib/clientes';
import { quienSoy } from '@/lib/identidad';

export const dynamic = 'force-dynamic';

export default async function Clientes() {
  const [yo, clientes] = await Promise.all([quienSoy(), listarClientes()]);

  return (
    <Shell
      titulo="Clientes"
      identidad={yo.nombre}
      ancho
      nota={`${clientes.length} clientes`}
      cuentas={{ '/os/clientes': clientes.length }}
    >
      <div className="os-encabezado">
        <h1>Clientes</h1>
      </div>

      <Cards clientes={clientes} />
    </Shell>
  );
}
