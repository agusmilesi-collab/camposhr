'use client';

/**
 * Quién es el cliente y con qué se le factura.
 *
 * Lo que antes eran cinco columnas de una tabla. Acá no compiten con nada: se
 * miran el día que hay que emitir un comprobante o llamar a alguien, y el resto
 * del tiempo lo que importa está abajo, en sus pedidos.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CopyLink from '@/app/informes/CopyLink';
import Cajon from '../Cajon';
import type { Cliente } from '@/lib/clientes';

const PORTAL = 'https://clientes.camposhr.com';

/** Un valor que falta se ve como que falta, no como un renglón vacío. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="os-cliente-dato">
      <span className="os-dato-rotulo">{rotulo}</span>
      {valor ? <span>{valor}</span> : <span className="os-dato-falta">sin cargar</span>}
    </div>
  );
}

export default function Ficha({ cliente }: { cliente: Cliente }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [cambiandoInformes, setCambiandoInformes] = useState(false);

  /**
   * Activar o desactivar.
   *
   * Un cliente inactivo es uno con el que no se está trabajando: sigue entero,
   * con sus pedidos y sus informes, y deja de estar entre los de todos los
   * días. No es borrarlo, que solo se hace cuando nunca debió existir.
   */
  async function cambiarEstado() {
    setTocando(true);
    try {
      await fetch('/api/os/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cliente.id, nombre: cliente.nombre, activa: !cliente.activa }),
      });
      router.refresh();
    } finally {
      setTocando(false);
    }
  }

  /**
   * Prender o apagar los informes en su portal.
   *
   * Apagados, el cliente sigue viendo en qué anda cada búsqueda y con qué
   * conclusión cerró cada candidato; lo que no puede es abrir el informe. Sirve
   * cuando se entregan por otro canal, o mientras no corresponde entregarlos.
   *
   * No es esconder un botón: las direcciones que sirven el informe contestan
   * que no existe mientras esté apagado.
   */
  async function cambiarInformes() {
    setCambiandoInformes(true);
    try {
      await fetch('/api/os/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cliente.id,
          nombre: cliente.nombre,
          informesVisibles: !cliente.informesVisibles,
        }),
      });
      router.refresh();
    } finally {
      setCambiandoInformes(false);
    }
  }

  return (
    <>
      <section className="os-panel">
        <div className="os-panel-top">
          <h2>
            Datos
            {!cliente.activa && (
              <span className="os-sello-estado os-gris os-titulo-sello">
                {cliente.pedidos === 0 && cliente.cotizaciones === 0
                  ? 'Inactivo · sin trabajo cargado'
                  : 'Inactivo'}
              </span>
            )}
          </h2>
          <div className="os-portal-acciones">
            {/* El enlace del portal vive con el cliente: es suyo y es lo que se
                le manda cuando pregunta cómo viene. */}
            {cliente.token ? (
              <>
                <a
                  className="os-boton"
                  href={`${PORTAL}/${cliente.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver portal
                </a>
                <CopyLink url={`${PORTAL}/${cliente.token}`} texto="Copiar enlace" />
              </>
            ) : (
              <span className="os-tabla-flojo">sin portal</span>
            )}
            {/* Un interruptor y no dos botones: lo que se lee de un vistazo es
                en qué estado está, y cambiarlo es un toque. El color lo dice
                antes que el texto. */}
            {cliente.token && (
              <button
                className={`os-boton os-boton-marcado os-sello-estado ${
                  cliente.informesVisibles ? 'os-verde' : 'os-rojo'
                }`}
                aria-pressed={cliente.informesVisibles}
                disabled={cambiandoInformes}
                onClick={cambiarInformes}
                title={
                  cliente.informesVisibles
                    ? 'Tocar para que el cliente deje de poder abrir los informes desde su portal.'
                    : 'Tocar para que el cliente pueda abrir los informes desde su portal.'
                }
              >
                {cambiandoInformes
                  ? '…'
                  : cliente.informesVisibles
                    ? 'Informes a la vista'
                    : 'Informes ocultos'}
              </button>
            )}
            <button className="os-boton" onClick={() => setEditando(true)}>
              Editar
            </button>
            {/* Un cliente sin un solo pedido ni una cotización enviada no se
                puede activar a mano: lo que lo activa es que entre trabajo. */}
            {(cliente.activa || cliente.pedidos > 0 || cliente.cotizaciones > 0) && (
              <button className="os-boton" disabled={tocando} onClick={cambiarEstado}>
                {tocando ? '…' : cliente.activa ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </div>

        <div className="os-panel-cuerpo os-cliente-datos">
          <Dato rotulo="Razón social" valor={cliente.razonSocial} />
          <Dato rotulo="CUIT" valor={cliente.cuit} />
          <Dato rotulo="Condición IVA" valor={cliente.condicionIva} />
          <Dato rotulo="Contacto" valor={cliente.contacto ?? cliente.emailFacturacion} />
          <Dato rotulo="Rubro" valor={cliente.rubro} />
          <Dato rotulo="Dirección fiscal" valor={cliente.direccionFiscal} />
        </div>
      </section>

      {editando && <Cajon cliente={cliente} alCerrar={() => setEditando(false)} />}
    </>
  );
}
