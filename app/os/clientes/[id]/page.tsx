import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../Shell';
import { listarClientes } from '@/lib/clientes';
import { listarPedidos } from '@/lib/pedidos';
import { quienSoy } from '@/lib/identidad';
import { baterias as listarBaterias, empresas as listarEmpresas } from '@/lib/altas';
import { ABIERTO } from '@/lib/pedido-campos';
import Ficha from './Ficha';
import Pedidos from './Pedidos';
import Contactos from './Contactos';
import { contactosDe } from '@/lib/contactos';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const dynamic = 'force-dynamic';

/**
 * Un cliente y sus pedidos.
 *
 * Las dos cosas juntas porque son la misma: un pedido no existe sin el cliente
 * que lo pidió, y hasta el 25/8/2026 vivían en dos secciones distintas, así que
 * saber cómo venía un cliente obligaba a cruzar de memoria qué pedido era de
 * quién.
 *
 * Arriba, quién es y con qué se le factura; abajo, lo que pidió, abierto y
 * cerrado.
 */
export default async function ClientePagina({ params }: { params: { id: string } }) {
  const [yo, clientes, pedidos, empresas, baterias, contactos] = await Promise.all([
    quienSoy(),
    listarClientes(),
    listarPedidos(),
    listarEmpresas(),
    listarBaterias(),
    contactosDe(params.id),
  ]);

  const cliente = clientes.find((c) => c.id === params.id);
  if (!cliente) notFound();

  const suyos = pedidos.filter((p) => p.empresaId === params.id);
  const abiertos = suyos.filter((p) => p.estado === ABIERTO);

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell
      titulo={`Clientes · ${cliente.nombre}`}
      identidad={yo.nombre}
      ancho
      nota={abiertos.length === 1 ? '1 pedido abierto' : `${abiertos.length} pedidos abiertos`}
      cuentas={cuentas}
    >
      <Link className="os-volver-enlace" href="/os/clientes">
        ← Volver a clientes
      </Link>

      <div className="os-encabezado">
        <h1>{cliente.nombre}</h1>
      </div>

      <Ficha cliente={cliente} />

      {/* Quién pide y quién paga, que son dos personas distintas casi siempre.
          Va entre los datos de la empresa y sus pedidos: se lee al llamar o al
          facturar, y se mira más seguido que el CUIT. */}
      <Contactos empresaId={params.id} contactos={contactos} />

      <Pedidos
        pedidos={suyos}
        empresaId={params.id}
        empresas={empresas}
        baterias={baterias}
      />
    </Shell>
  );
}
