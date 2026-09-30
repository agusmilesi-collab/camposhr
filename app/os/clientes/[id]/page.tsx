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
import Abrir from '../../pedidos/Abrir';
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
export default async function ClientePagina({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ver?: string };
}) {
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

  /* Dos pestañas: los datos del cliente (empresa, portal, contactos) y sus
     pedidos. Lo que no sea "pedidos" cae en datos. */
  const ver = searchParams.ver === 'pedidos' ? 'pedidos' : 'datos';
  const pestanas = [
    { clave: 'datos', texto: 'Datos', cuantos: 0 },
    { clave: 'pedidos', texto: 'Pedidos', cuantos: abiertos.length },
  ];

  return (
    <Shell
      titulo={`Clientes · ${cliente.nombre}`}
      identidad={yo.nombre}
      ancho
      nota={abiertos.length === 1 ? '1 pedido abierto' : `${abiertos.length} pedidos abiertos`}
      cuentas={cuentas}
    >
      {/* Un envoltorio para que todos los botones de la ficha midan lo mismo. */}
      <div className="os-cliente-pagina">
        <Link className="os-volver-enlace" href="/os/clientes">
          ← Volver a clientes
        </Link>

        <div className="os-encabezado">
          <h1>{cliente.nombre}</h1>
        </div>

        <div className="os-pestanas-fila">
          <nav className="os-pestanas">
            {pestanas.map((p) => (
              <Link
                key={p.clave}
                href={`/os/clientes/${params.id}?ver=${p.clave}`}
                className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
                aria-current={ver === p.clave ? 'page' : undefined}
              >
                {p.texto}
                {/* En Pedidos, cuántos hay abiertos: es lo que se busca antes
                    de entrar. */}
                {p.cuantos > 0 && <span className="os-pestana-cuenta">{p.cuantos}</span>}
              </Link>
            ))}
          </nav>
          {/* Nuevo pedido a la altura de las pestañas, del lado derecho: es lo
              que se hace apenas entra el mail del cliente. */}
          <Abrir empresas={empresas} baterias={baterias} empresaFija={params.id} />
        </div>

        {/* Quién pide y quién paga, que son dos personas distintas casi siempre.
          Va en la misma tarjeta que los datos de la empresa: se lee al llamar
          o al facturar, y se mira más seguido que el CUIT. */}
        {ver === 'datos' && (
          <Ficha cliente={cliente}>
            <Contactos empresaId={params.id} contactos={contactos} />
          </Ficha>
        )}

        {ver === 'pedidos' && (
          <Pedidos pedidos={suyos} empresaId={params.id} empresas={empresas} baterias={baterias} />
        )}
      </div>
    </Shell>
  );
}
