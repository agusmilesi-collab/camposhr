'use client';

/**
 * Los campos del pedido, editables en su lugar.
 *
 * Cada campo guarda al soltarlo, como en el resto del OS: un botón de guardar
 * suelto es un cambio que se pierde. La fila queda apagada un instante
 * mientras viaja, y si falla vuelve al valor anterior con el motivo al pie.
 *
 * Las nueve preguntas de puesto y jefe son tres opciones cada una, en botones
 * del mismo ancho: elegir es un toque y las tres se leen juntas, que es como
 * se contesta cuando el cliente las va diciendo por teléfono.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Opciones from '@/app/os/Opciones';

export function useGuardar(id: string) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /* Los campos del pedido son texto casi todos, pero el nivel de trabajo tiene
     dos números y un objeto con las cinco respuestas: el valor viaja como
     viene y quien lo recibe lo comprueba. */
  async function guardar(
    campo: string,
    valor: string | boolean | number | Record<string, boolean> | null
  ): Promise<boolean> {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo, valor }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return false;
      }
      empezar(() => router.refresh());
      return true;
    } catch {
      setError('No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  return { guardar, error, guardando };
}

/** Un texto de una línea. */
export function Texto({
  id,
  campo,
  valor,
  rotulo,
  ancho,
}: {
  id: string;
  campo: string;
  valor: string | null;
  rotulo: string;
  ancho?: boolean;
}) {
  const { guardar, error } = useGuardar(id);
  return (
    <div className={`os-ficha-dato${ancho ? ' os-ficha-dato-ancho' : ''}`}>
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">
        <input
          className="os-campo"
          defaultValue={valor ?? ''}
          maxLength={200}
          onBlur={(e) => {
            if (e.target.value !== (valor ?? '')) guardar(campo, e.target.value);
          }}
          aria-label={rotulo}
        />
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </div>
  );
}

/** Un texto largo: lo que pidió el cliente, cómo es la empresa. */
export function Largo({
  id,
  campo,
  valor,
  rotulo,
  ayuda,
  fila,
}: {
  id: string;
  campo: string;
  valor: string | null;
  rotulo: string;
  ayuda?: string;
  /** Ocupa la fila entera cuando el bloque va en dos columnas. */
  fila?: boolean;
}) {
  const { guardar, error } = useGuardar(id);
  return (
    <div className={`os-ficha-dato os-ficha-dato-ancho${fila ? ' os-ficha-dato-fila' : ''}`}>
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">
        {/* Ocupa todo el ancho de su celda: es donde se copia lo que dijo el
            cliente, el campo más largo del pedido, y entraba en 181 px de los
            385 que tenía al lado. */}
        <textarea
          className="os-campo os-campo-parrafo"
          rows={4}
          maxLength={4000}
          defaultValue={valor ?? ''}
          placeholder={ayuda}
          onBlur={(e) => {
            if (e.target.value !== (valor ?? '')) guardar(campo, e.target.value || null);
          }}
          aria-label={rotulo}
        />
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </div>
  );
}

/** Una lista cerrada: familia, nivel, batería. */
export function Lista({
  id,
  campo,
  valor,
  rotulo,
  opciones,
  vacio = 'Sin definir',
}: {
  id: string;
  campo: string;
  valor: string | null;
  rotulo: string;
  opciones: { valor: string; texto: string }[];
  vacio?: string;
}) {
  const { guardar, error } = useGuardar(id);
  const [puesto, setPuesto] = useState(valor ?? '');
  return (
    <div className="os-ficha-dato">
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">
        <select
          className="os-campo"
          value={puesto}
          onChange={async (e) => {
            const antes = puesto;
            setPuesto(e.target.value);
            const ok = await guardar(campo, e.target.value || null);
            if (!ok) setPuesto(antes);
          }}
          aria-label={rotulo}
        >
          <option value="">{vacio}</option>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </div>
  );
}

/** Una fecha. */
export function Fecha({
  id,
  campo,
  valor,
  rotulo,
}: {
  id: string;
  campo: string;
  valor: string | null;
  rotulo: string;
}) {
  const { guardar, error } = useGuardar(id);
  return (
    <div className="os-ficha-dato">
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">
        <input
          className="os-campo"
          type="date"
          defaultValue={valor ?? ''}
          onChange={(e) => guardar(campo, e.target.value || null)}
          aria-label={rotulo}
        />
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </div>
  );
}

/** El adicional: se compra por búsqueda y vale para todos sus candidatos. */
export function Benziger({
  id,
  puesto,
  usd,
  enPesos,
}: {
  id: string;
  puesto: boolean;
  usd: number;
  /** Cuánto suma en pesos al dólar tarjeta, si se pudo leer la cotización. */
  enPesos: string | null;
}) {
  const { guardar, error } = useGuardar(id);
  const [valor, setValor] = useState(puesto);
  return (
    <div className="os-ficha-dato">
      <div className="os-ficha-rotulo">Benziger</div>
      <div className="os-ficha-valor">
        <label className="os-agregar-opcion">
          <input
            type="checkbox"
            checked={valor}
            onChange={async (e) => {
              const antes = valor;
              setValor(e.target.checked);
              const ok = await guardar('con_benziger', e.target.checked);
              if (!ok) setValor(antes);
            }}
          />
          Lo lleva · USD {usd}
          {enPesos ? ` · ${enPesos}` : ''} por evaluación
        </label>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Una de las nueve preguntas: tres opciones, todas del mismo ancho.
 *
 * Volver a tocar la elegida la borra: es la única forma de dejar en blanco una
 * pregunta que se contestó por error, sin sumarle un cuarto botón a cada una.
 */
export function Pregunta({
  id,
  campo,
  rotulo,
  valor,
  opciones,
  ayudas = [],
}: {
  id: string;
  campo: string;
  rotulo: string;
  valor: string | null;
  opciones: string[];
  /** Qué significa cada opción, en el mismo orden. Sale al pasar por encima. */
  ayudas?: string[];
}) {
  const { guardar, error } = useGuardar(id);
  const [puesto, setPuesto] = useState(valor);

  async function elegir(o: string) {
    const antes = puesto;
    const nuevo = puesto === o ? null : o;
    setPuesto(nuevo);
    const ok = await guardar(campo, nuevo);
    if (!ok) setPuesto(antes);
  }

  return (
    <div className="os-seguimiento-fila">
      <span className="os-dato-rotulo">{rotulo}</span>
      <Opciones
        valor={puesto}
        opciones={opciones.map((o, i) => ({
          v: o as string | null,
          texto: o,
          ayuda: ayudas[i],
        }))}
        alElegir={(v) => elegir(v as string)}
        etiqueta={rotulo}
      />
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}

/**
 * Cerrar el pedido, o volver a abrirlo.
 *
 * Cerrar es lo que hace que deje de ofrecerse al cargar candidatos, y es el
 * único cambio de esta pantalla que se ve en otras. Por eso avisa cuántas
 * evaluaciones quedan sin entregar antes de dejarlo cerrar.
 */
export function Estado({
  id,
  estado,
  abierto,
  pendientes,
}: {
  id: string;
  estado: string;
  abierto: string;
  pendientes: number;
}) {
  const { guardar, error, guardando } = useGuardar(id);
  const [valor, setValor] = useState(estado);
  const [confirmar, setConfirmar] = useState(false);

  async function poner(nuevo: string) {
    const antes = valor;
    setValor(nuevo);
    setConfirmar(false);
    const ok = await guardar('estado', nuevo);
    if (!ok) setValor(antes);
  }

  if (valor !== abierto) {
    return (
      <div className="os-pedido-cierre">
        <p className="os-pedido-cerrado">
          {valor}. No aparece al cargar candidatos.
        </p>
        <button
          type="button"
          className="os-boton"
          disabled={guardando}
          onClick={() => poner(abierto)}
        >
          Volver a abrir
        </button>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="os-pedido-cierre">
      {confirmar ? (
        <>
          <p className="os-pedido-aviso">
            {pendientes > 0
              ? `Quedan ${pendientes} ${
                  pendientes === 1 ? 'evaluación sin entregar' : 'evaluaciones sin entregar'
                }. Cerrarlo lo saca del selector de alta; las que están en curso siguen su camino.`
              : 'Deja de ofrecerse al cargar candidatos. Se puede volver a abrir.'}
          </p>
          <div className="os-agregar-pie">
            <button
              type="button"
              className="os-boton os-boton-firme"
              disabled={guardando}
              onClick={() => poner('Finalizado')}
            >
              Finalizado
            </button>
            <button
              type="button"
              className="os-boton"
              disabled={guardando}
              onClick={() => poner('Cancelado')}
            >
              Cancelado
            </button>
            <button type="button" className="os-boton" onClick={() => setConfirmar(false)}>
              Dejarlo abierto
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="os-boton" onClick={() => setConfirmar(true)}>
          Cerrar el pedido
        </button>
      )}
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}

/**
 * Borrar el pedido, para lo que nunca debió existir.
 *
 * Va separado del cierre y con su propio paso de confirmación, porque las dos
 * cosas se parecen y hacen lo contrario: cerrar guarda todo y lo saca del
 * selector, borrar no deja nada. El que tiene candidatos ni siquiera muestra el
 * botón: ahí la respuesta correcta es cerrarlo, y ofrecer un borrado que el
 * servidor va a rechazar es hacer perder un clic para leer un error.
 */
export function Borrar({
  id,
  puesto,
  candidatos,
}: {
  id: string;
  puesto: string;
  candidatos: number;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (candidatos > 0) {
    return (
      <p className="os-pedido-cerrado">
        Con candidatos cargados no se borra: quedarían sin saber a qué búsqueda entraron. Cerralo
        y sale de la lista de alta.
      </p>
    );
  }

  async function borrar() {
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch(`/api/os/pedidos?id=${id}`, { method: 'DELETE' });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo borrar.');
        setBorrando(false);
        return;
      }
      router.push('/os/pedidos');
      router.refresh();
    } catch {
      setError('No se pudo borrar.');
      setBorrando(false);
    }
  }

  return (
    <div className="os-pedido-borrar os-cajon-riesgo">
      {confirmar ? (
        <>
          <p className="os-pedido-aviso">
            Se borra «{puesto}» y no se puede deshacer.
          </p>
          <div className="os-pedido-borrar-pie">
            <button
              type="button"
              className="os-boton os-boton-peligro"
              disabled={borrando}
              onClick={borrar}
            >
              {borrando ? 'Borrando…' : 'Borrarlo'}
            </button>
            <button type="button" className="os-boton" onClick={() => setConfirmar(false)}>
              Mejor no
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="os-boton" onClick={() => setConfirmar(true)}>
          Borrar el pedido
        </button>
      )}
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
