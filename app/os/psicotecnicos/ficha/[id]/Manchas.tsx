'use client';

/**
 * La codificación Rorschach, fila por fila.
 *
 * Es la pantalla donde la evaluadora carga el protocolo, con los mismos campos,
 * los mismos desplegables y los mismos colores que la tabla "Tests Proyectivos"
 * de Airtable, que es lo que viene usando. Las opciones salen de
 * `lib/rorschach.ts`, generado desde el esquema de esa tabla.
 *
 * Cada celda guarda sola al cambiar, como el resto del pipeline: un botón de
 * guardar suelto es un protocolo a medio cargar cuando alguien cierra la
 * pestaña. Lo que se ve en pantalla se actualiza antes de que conteste el
 * servidor, y si el guardado falla la fila vuelve a su valor y aparece el
 * motivo.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  CC_EE,
  CONTENIDOS,
  DETERMINANTES,
  FQ,
  LAMINA,
  LOCALIZACION,
  tonoDe,
  type Opcion,
} from '@/lib/rorschach';
import type { Mancha } from '@/lib/ficha';

/** Una etiqueta con el color que le toca a ese código. */
function Chip({ valor, opciones }: { valor: string; opciones: Opcion[] }) {
  return (
    <span className="os-chip" style={{ background: tonoDe(opciones, valor) }}>
      {valor}
    </span>
  );
}

function Simple({
  valor,
  opciones,
  onCambio,
  ancho,
}: {
  valor: string | null;
  opciones: Opcion[];
  onCambio: (v: string | null) => void;
  ancho?: number;
}) {
  return (
    <span className="os-celda-select">
      {valor && <Chip valor={valor} opciones={opciones} />}
      <select
        className="os-select-encima"
        value={valor ?? ''}
        style={ancho ? { width: ancho } : undefined}
        onChange={(e) => onCambio(e.target.value || null)}
        aria-label="Opción"
      >
        <option value="">—</option>
        {opciones.map((o) => (
          <option key={o.v} value={o.v}>
            {o.v}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Varios códigos en una celda.
 *
 * El desplegable agrega y cada etiqueta se saca con su cruz. Se eligió esto en
 * vez de una lista con control para elegir varios porque en una tabla de
 * veinticinco filas hay que ver lo cargado de un vistazo, no abrir cada celda.
 */
function Multiple({
  valores,
  opciones,
  onCambio,
}: {
  valores: string[];
  opciones: Opcion[];
  onCambio: (v: string[]) => void;
}) {
  return (
    <div className="os-celda-multiple">
      {valores.map((v) => (
        <span key={v} className="os-chip" style={{ background: tonoDe(opciones, v) }}>
          {v}
          <button
            type="button"
            className="os-chip-quitar"
            onClick={() => onCambio(valores.filter((x) => x !== v))}
            aria-label={`Quitar ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <select
        className="os-chip-agregar"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !valores.includes(v)) onCambio([...valores, v]);
        }}
        aria-label="Agregar"
      >
        <option value="">+</option>
        {opciones
          .filter((o) => !valores.includes(o.v))
          .map((o) => (
            <option key={o.v} value={o.v}>
              {o.v}
            </option>
          ))}
      </select>
    </div>
  );
}

function Tilde({ puesto, onCambio }: { puesto: boolean; onCambio: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`os-check${puesto ? ' puesto' : ''}`}
      onClick={() => onCambio(!puesto)}
      aria-pressed={puesto}
      aria-label={puesto ? 'Sí' : 'No'}
    >
      ✓
    </button>
  );
}

function Numero({
  valor,
  onCambio,
  paso,
}: {
  valor: number | null;
  onCambio: (v: string) => void;
  paso?: string;
}) {
  return (
    <input
      className="os-campo os-campo-numero"
      type="number"
      step={paso}
      defaultValue={valor ?? ''}
      onBlur={(e) => onCambio(e.target.value)}
      aria-label="Número"
    />
  );
}

export default function Manchas({
  evaluacionId,
  filas,
}: {
  evaluacionId: string;
  filas: Mancha[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [locales, setLocales] = useState<Mancha[]>(filas);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Lo que llega del servidor manda salvo mientras hay algo sin confirmar: sin
  // esto, cada refresco pisaría lo que se acaba de tipear.
  const [sucio, setSucio] = useState(false);
  const vista = sucio ? locales : filas;

  async function pedir(init: RequestInit & { url?: string }): Promise<any> {
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch(init.url ?? '/api/os/manchas', {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return null;
      }
      return r;
    } catch {
      setError('No se pudo guardar.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function cambiar(id: string, campos: Record<string, unknown>) {
    const antes = vista;
    setSucio(true);
    setLocales(vista.map((f) => (f.id === id ? { ...f, ...(campos as object) } : f)));

    const r = await pedir({ method: 'POST', body: JSON.stringify({ id, campos }) });
    if (!r) {
      setLocales(antes);
      return;
    }
    empezar(() => {
      router.refresh();
      setSucio(false);
    });
  }

  async function agregar() {
    const siguiente = Math.max(0, ...vista.map((f) => f.n_respuesta ?? 0)) + 1;
    const r = await pedir({
      method: 'PUT',
      body: JSON.stringify({ evaluacionId, campos: { n_respuesta: siguiente } }),
    });
    if (r) empezar(() => router.refresh());
  }

  async function borrar(id: string) {
    const r = await pedir({ method: 'DELETE', url: `/api/os/manchas?id=${id}` });
    if (r) empezar(() => router.refresh());
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-manchas">
          <thead>
            <tr>
              <th>Lámina</th>
              <th>Nº rta</th>
              <th>Loc. + DQ</th>
              <th>Nº loc.</th>
              <th>Determinantes</th>
              <th>FQ</th>
              <th>Par</th>
              <th>Contenidos</th>
              <th>P</th>
              <th>Pje Z</th>
              <th>CC.EE</th>
              <th>AgC</th>
              <th className="os-tabla-accion" />
            </tr>
          </thead>
          <tbody>
            {vista.map((f) => (
              <tr key={f.id}>
                <td>
                  <Simple
                    valor={f.lamina}
                    opciones={LAMINA}
                    onCambio={(v) => cambiar(f.id, { lamina: v })}
                    ancho={72}
                  />
                </td>
                <td>
                  <Numero valor={f.n_respuesta} onCambio={(v) => cambiar(f.id, { n_respuesta: v })} />
                </td>
                <td>
                  <Simple
                    valor={f.localizacion}
                    opciones={LOCALIZACION}
                    onCambio={(v) => cambiar(f.id, { localizacion: v })}
                    ancho={92}
                  />
                </td>
                <td>
                  <input
                    className="os-campo os-campo-corto"
                    defaultValue={f.n_localizacion ?? ''}
                    onBlur={(e) => cambiar(f.id, { n_localizacion: e.target.value })}
                    aria-label="Número de localización"
                  />
                </td>
                <td>
                  <Multiple
                    valores={f.determinantes ?? []}
                    opciones={DETERMINANTES}
                    onCambio={(v) => cambiar(f.id, { determinantes: v })}
                  />
                </td>
                <td>
                  <Simple
                    valor={f.fq}
                    opciones={FQ}
                    onCambio={(v) => cambiar(f.id, { fq: v })}
                    ancho={68}
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.par)} onCambio={(v) => cambiar(f.id, { par: v })} />
                </td>
                <td>
                  <Multiple
                    valores={f.contenidos ?? []}
                    opciones={CONTENIDOS}
                    onCambio={(v) => cambiar(f.id, { contenidos: v })}
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.popular)} onCambio={(v) => cambiar(f.id, { popular: v })} />
                </td>
                <td>
                  <Numero valor={f.z} paso="0.5" onCambio={(v) => cambiar(f.id, { z: v })} />
                </td>
                <td>
                  <Multiple
                    valores={f.cc_ee ?? []}
                    opciones={CC_EE}
                    onCambio={(v) => cambiar(f.id, { cc_ee: v })}
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.agc)} onCambio={(v) => cambiar(f.id, { agc: v })} />
                </td>
                <td className="os-tabla-accion">
                  <button
                    type="button"
                    className="os-boton os-boton-borrar"
                    disabled={ocupado}
                    onClick={() => borrar(f.id)}
                    title="Borrar la respuesta"
                    aria-label="Borrar la respuesta"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="os-barra-acciones">
        <button className="os-boton" disabled={ocupado} onClick={agregar}>
          Agregar respuesta
        </button>
        <span className="os-columna-monto">
          {vista.length === 1 ? '1 respuesta' : `${vista.length} respuestas`}
        </span>
      </div>
    </>
  );
}
