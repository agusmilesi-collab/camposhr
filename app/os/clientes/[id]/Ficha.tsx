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
import Desplegable from '@/app/os/Desplegable';
import { CONDICIONES, leyendaIva } from '@/lib/clientes-tipos';
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

/** Un dato de la empresa convertido en campo, con su rótulo arriba. */
function Campo({
  rotulo,
  nombre,
  valor,
  requerido = false,
}: {
  rotulo: string;
  nombre: string;
  valor: string | null;
  requerido?: boolean;
}) {
  return (
    <label className="os-cliente-dato">
      <span className="os-dato-rotulo">{rotulo}</span>
      <input
        className="os-campo"
        name={nombre}
        defaultValue={valor ?? ''}
        required={requerido}
        maxLength={200}
      />
    </label>
  );
}

export default function Ficha({
  cliente,
  children,
}: {
  cliente: Cliente;
  /** Lo que va en la misma tarjeta debajo de los datos: los contactos. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  /**
   * Guardar los datos de la empresa, editados ahí mismo.
   *
   * Sin cajón: son cinco datos y se corrigen mirándolos. Manda solo los campos
   * del formulario; la ruta deja como están los que no vienen.
   */
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget).entries());
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, id: cliente.id }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return;
      }
      setEditando(false);
      router.refresh();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /* Un cliente sin un solo pedido ni una cotización enviada no se puede
     activar a mano: lo que lo activa es que entre trabajo. */
  const puedeCambiarEstado = cliente.activa || cliente.pedidos > 0 || cliente.cotizaciones > 0;
  const textoEstado = cliente.activa
    ? 'Activo'
    : cliente.pedidos === 0 && cliente.cotizaciones === 0
      ? 'Inactivo · sin trabajo cargado'
      : 'Inactivo';

  return (
    <>
      <section className="os-panel">
        {/* Los datos fiscales con su propio título, como los contactos debajo:
            son las partes de la tarjeta. El lápiz los vuelve campos ahí mismo. */}
        <div className="os-panel-top os-cliente-subtitulo os-empresa-top">
          <h2>Empresa</h2>
        </div>

        {editando ? (
          <form
            className="os-panel-cuerpo os-cliente-datos os-cliente-datos-tres os-cliente-edita"
            onSubmit={guardar}
          >
            <Campo rotulo="Nombre" nombre="nombre" valor={cliente.nombre} requerido />
            <Campo rotulo="Razón social" nombre="razonSocial" valor={cliente.razonSocial} />
            <Campo rotulo="CUIT" nombre="cuit" valor={cliente.cuit} />
            <label className="os-cliente-dato">
              <span className="os-dato-rotulo">Condición IVA</span>
              <select
                className="os-campo"
                name="condicionIva"
                defaultValue={cliente.condicionIva ?? ''}
              >
                <option value="">Sin definir</option>
                {/* Se elige por la leyenda que fija ARCA, que es la que sale
                    impresa en la factura. */}
                {CONDICIONES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.leyenda}
                  </option>
                ))}
              </select>
            </label>
            <Campo
              rotulo="Dirección fiscal"
              nombre="direccionFiscal"
              valor={cliente.direccionFiscal}
            />
            {/* Hay clientes que dan su propia orden de compra y no pagan la
                factura que no la trae. Marcado acá, Facturación la pide. */}
            <label className="os-cliente-dato">
              <span className="os-dato-rotulo">Orden de compra propia</span>
              <select
                className="os-campo"
                name="exigeOrdenCompra"
                defaultValue={cliente.exigeOrdenCompra ? 'si' : 'no'}
              >
                <option value="no">No la exige</option>
                <option value="si">La exige en la factura</option>
              </select>
            </label>
            <Campo rotulo="Rubro" nombre="rubro" valor={cliente.rubro} />
            <div className="os-portal-acciones os-cliente-datos-acciones">
              <button className="os-boton os-boton-firme" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                className="os-boton"
                type="button"
                disabled={guardando}
                onClick={() => {
                  setEditando(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
            {error && <p className="os-form-error os-campo-entero">{error}</p>}
          </form>
        ) : (
          <div className="os-panel-cuerpo os-cliente-datos os-cliente-datos-tres">
            <Dato rotulo="Razón social" valor={cliente.razonSocial} />
            <Dato rotulo="CUIT" valor={cliente.cuit} />
            <Dato rotulo="Condición IVA" valor={leyendaIva(cliente.condicionIva)} />
            <Dato rotulo="Dirección fiscal" valor={cliente.direccionFiscal} />
            <Dato
              rotulo="Orden de compra propia"
              valor={cliente.exigeOrdenCompra ? 'La exige en la factura' : 'No la exige'}
            />
            <Dato rotulo="Rubro" valor={cliente.rubro} />
          </div>
        )}

        {/* El portal, entre la empresa y sus contactos: lo que el cliente ve y
            el enlace que se le manda. */}
        {/* Una fila con dos lados: a la izquierda lo del cliente (si está
            activo y editarlo), a la derecha lo de su portal. */}
        <section className="os-cliente-portal os-cliente-fila">
          <div className="os-cliente-fila-lado">
            <h2>Cliente</h2>
            {/* Activo o inactivo con palabras y su punto de color; se cambia
                tocándolo, como el estado de los informes. */}
            <Desplegable
              valor={cliente.activa ? 'activo' : 'inactivo'}
              opciones={[
                { valor: 'activo', texto: 'Activo', color: 'os-verde' },
                {
                  valor: 'inactivo',
                  texto: cliente.activa ? 'Inactivo' : textoEstado,
                  color: 'os-gris',
                },
              ]}
              alElegir={(v) => {
                if ((v === 'activo') !== cliente.activa) cambiarEstado();
              }}
              deshabilitado={tocando || !puedeCambiarEstado}
              etiqueta={
                puedeCambiarEstado
                  ? 'Si el cliente está activo'
                  : 'Se activa solo cuando entra un pedido o sale una cotización.'
              }
            />
            {!editando && (
              <button className="os-boton" onClick={() => setEditando(true)}>
                Editar cliente
              </button>
            )}
          </div>

          <div className="os-cliente-fila-lado os-cliente-fila-derecha">
            <h2>Portal</h2>
            {cliente.token ? (
              <>
                {/* Si el cliente puede abrir los informes desde su portal. */}
                <Desplegable
                  valor={cliente.informesVisibles ? 'vista' : 'proximamente'}
                  opciones={[
                    { valor: 'vista', texto: 'Informes a la vista', color: 'os-verde' },
                    { valor: 'proximamente', texto: 'Informes: próximamente', color: 'os-rojo' },
                  ]}
                  alElegir={(v) => {
                    if ((v === 'vista') !== cliente.informesVisibles) cambiarInformes();
                  }}
                  deshabilitado={cambiandoInformes}
                  etiqueta="Si el cliente ve los informes en su portal"
                />
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
          </div>
        </section>
        {children}
      </section>
    </>
  );
}
