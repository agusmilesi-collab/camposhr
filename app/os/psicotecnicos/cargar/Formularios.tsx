'use client';

/**
 * Cargar un pedido o un candidato.
 *
 * Son dos formularios y no uno, porque adentro las dos cosas pasan en momentos
 * distintos: el cliente manda un mail pidiendo un jefe de depósito, y los
 * candidatos aparecen de a uno en los días siguientes. El formulario del
 * portal los pide juntos porque ahí el cliente ya tiene a quién evaluar.
 *
 * Los dos caen sobre la misma grilla de dos columnas: un campo ocupa una o las
 * dos, nunca un ancho propio.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Opcion = { id: string; nombre: string };
type PedidoOpcion = { id: string; puesto: string; empresa: string; candidatos: number };

const SENIORITY = ['Operativo', 'Semi senior', 'Senior', 'Jefatura', 'Gerencia'];

/** Un campo de la grilla. `entero` lo estira de borde a borde. */
function Campo({
  id,
  rotulo,
  entero,
  children,
}: {
  id: string;
  rotulo: string;
  entero?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`os-campo-bloque${entero ? ' os-campo-entero' : ''}`}>
      <label className="os-etiqueta-campo" htmlFor={id}>
        {rotulo}
      </label>
      {children}
    </div>
  );
}

function useAlta(mensajeOk: string) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>, despues?: () => void) {
    e.preventDefault();
    const form = e.currentTarget;
    setEnviando(true);
    setError(null);
    setHecho(null);
    try {
      const res = await fetch('/api/os/altas', { method: 'POST', body: new FormData(form) });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? 'No se pudo guardar.');
        return;
      }
      setHecho(mensajeOk);
      form.reset();
      despues?.();
      router.refresh();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return { enviar, enviando, error, hecho };
}

export function FormPedido({
  empresas,
  baterias,
}: {
  empresas: Opcion[];
  baterias: { id: string; codigo: string; nombre: string }[];
}) {
  const [clienteNuevo, setClienteNuevo] = useState(false);

  /**
   * La fecha del pedido arranca en hoy, que es cuando entra casi todo pedido.
   *
   * Se pone desde el navegador y no como valor por defecto del servidor: el
   * servidor corre en otro huso y a la tarde podría proponer el día siguiente.
   *
   * Va como `defaultValue` del campo y no como su valor: así el `reset()` que
   * corre al guardar la vuelve a dejar en hoy, en vez de vaciarla para el
   * pedido siguiente.
   */
  const fecha = useRef<HTMLInputElement>(null);
  const hoy = () => {
    const d = new Date();
    const dosDigitos = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  };

  useEffect(() => {
    if (fecha.current && !fecha.current.value) fecha.current.defaultValue = hoy();
  }, []);
  const { enviar, enviando, error, hecho } = useAlta(
    'Pedido cargado. Ya se le pueden sumar candidatos.'
  );

  return (
    <form className="os-form" onSubmit={(e) => enviar(e, () => setClienteNuevo(false))}>
      <input type="hidden" name="tipo" value="pedido" />

      <Campo id="empresaId" rotulo="Cliente" entero>
        {clienteNuevo ? (
          <input
            className="os-campo"
            name="empresaNueva"
            placeholder="Nombre del cliente"
            maxLength={120}
            required
            autoFocus
          />
        ) : (
          <select className="os-campo" id="empresaId" name="empresaId" required>
            <option value="">Elegí un cliente</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="os-enlace-boton"
          onClick={() => setClienteNuevo((v) => !v)}
        >
          {clienteNuevo ? 'Elegir uno de la lista' : 'Es un cliente nuevo'}
        </button>
      </Campo>

      <Campo id="puesto" rotulo="Puesto que se busca" entero>
        <input
          className="os-campo"
          id="puesto"
          name="puesto"
          required
          maxLength={120}
          placeholder="Jefe de depósito"
        />
      </Campo>

      <Campo id="bateriaId" rotulo="Batería">
        <select className="os-campo" id="bateriaId" name="bateriaId">
          <option value="">A definir</option>
          {baterias.map((b) => (
            <option key={b.id} value={b.id}>
              {b.codigo} · {b.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="seniority" rotulo="Nivel">
        <select className="os-campo" id="seniority" name="seniority">
          <option value="">Sin definir</option>
          {SENIORITY.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="fechaPedido" rotulo="Fecha del pedido" entero>
        <input
          ref={fecha}
          className="os-campo"
          id="fechaPedido"
          name="fechaPedido"
          type="date"
        />
      </Campo>

      <Campo id="notas" rotulo="Qué pidió el cliente" entero>
        <textarea
          className="os-campo"
          id="notas"
          name="notas"
          rows={3}
          maxLength={4000}
          placeholder="Lo que dice el mail: contexto, urgencia, a quién reporta."
        />
      </Campo>

      {error && <p className="os-form-error">{error}</p>}
      {hecho && <p className="os-form-ok">{hecho}</p>}

      <div className="os-campo-entero os-form-pie">
        <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Cargar el pedido'}
        </button>
      </div>
    </form>
  );
}

export function FormCandidato({
  pedidos,
  evaluadoras,
}: {
  pedidos: PedidoOpcion[];
  evaluadoras: Opcion[];
}) {
  const { enviar, enviando, error, hecho } = useAlta(
    'Candidato cargado. Aparece en la etapa que le corresponde.'
  );

  if (pedidos.length === 0) {
    return (
      <p className="os-vacio">
        No hay ningún pedido abierto. Cargá primero el pedido y después sus
        candidatos.
      </p>
    );
  }

  return (
    <form className="os-form" onSubmit={(e) => enviar(e)}>
      <input type="hidden" name="tipo" value="candidato" />

      <Campo id="pedidoId" rotulo="Para qué pedido" entero>
        <select className="os-campo" id="pedidoId" name="pedidoId" required>
          <option value="">Elegí el pedido</option>
          {pedidos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.empresa} · {p.puesto}
              {p.candidatos > 0 ? ` (${p.candidatos})` : ''}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="nombre" rotulo="Nombre y apellido" entero>
        <input className="os-campo" id="nombre" name="nombre" required maxLength={120} />
      </Campo>

      <Campo id="telefono" rotulo="Teléfono">
        <input className="os-campo" id="telefono" name="telefono" type="tel" maxLength={40} />
      </Campo>

      <Campo id="email" rotulo="Correo">
        <input className="os-campo" id="email" name="email" type="email" maxLength={120} />
      </Campo>

      <Campo id="evaluadoraId" rotulo="Evaluadora" entero>
        <select className="os-campo" id="evaluadoraId" name="evaluadoraId">
          <option value="">Sin asignar</option>
          {evaluadoras.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="cv" rotulo="CV" entero>
        <input
          className="os-campo"
          id="cv"
          name="cv"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
        />
      </Campo>

      <p className="os-form-nota">
        Con teléfono o correo alcanza, hace falta uno de los dos para poder
        citarla. Si le asignás evaluadora entra en Por citar; si no, queda en
        Sin asignar.
      </p>

      {error && <p className="os-form-error">{error}</p>}
      {hecho && <p className="os-form-ok">{hecho}</p>}

      <div className="os-campo-entero os-form-pie">
        <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Cargar el candidato'}
        </button>
      </div>
    </form>
  );
}
