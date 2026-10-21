'use client';

/**
 * Los precios de los servicios que no son baterías, en una tabla editable.
 *
 * Coaching, entrevista de egreso, devolución y referencias: salen en la página
 * de precios. Como en las baterías, el cambio lleva la fecha desde la que rige
 * (arranca en hoy y se puede adelantar): hasta ese día sigue el precio
 * anterior y ese día la página pasa sola al nuevo. Se guarda todo junto en
 * `ajustes` (`servicios_precios`), por tramos; "Volver a los de fábrica"
 * borra la clave.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { AjustePorIpc, TramoDePrecios } from '@/lib/precios-servicios';

type Fila = {
  clave: string;
  nombre: string;
  unidad: string;
  deFabrica: number;
  rige: number;
  /** El precio del aumento ya cargado que todavía no empezó. */
  proximo: number | null;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "IPC jul a sep 5,8 %". */
function ipcTexto(a: AjustePorIpc): string {
  const mes = (m: string) => MESES[Number(m.slice(5, 7)) - 1];
  return `IPC ${mes(a.meses[0])} a ${mes(a.meses[a.meses.length - 1])} ${a.porcentaje.toLocaleString('es-AR')} %`;
}

function dia(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${fecha}T12:00:00`)
  );
}

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ServiciosPrecios({
  filas,
  proximoDesde,
  proximoIpc,
  ultimoIpc,
  sinIpc,
  proximoAjuste,
  tramos,
  hoy,
}: {
  filas: Fila[];
  proximoDesde: string | null;
  /** Si lo próximo es el ajuste trimestral, con qué meses y cuánto. */
  proximoIpc: AjustePorIpc | null;
  /** El último ajuste por IPC que ya se aplicó, si hubo. */
  ultimoIpc: AjustePorIpc | null;
  /** El ajuste que ya tocaba y no se aplicó porque falta un mes del IPC. */
  sinIpc: string | null;
  /** Cuándo toca el próximo ajuste trimestral. */
  proximoAjuste: string;
  tramos: TramoDePrecios[];
  /** Hoy en Argentina, del servidor, para el valor inicial de la fecha. */
  hoy: string;
}) {
  const router = useRouter();
  const inicial = () => Object.fromEntries(filas.map((f) => [f.clave, String(f.rige)]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [desde, setDesde] = useState(hoy);

  // Lo que manda el servidor después de guardar, comparado por valor: si no,
  // volver a los de fábrica dejaba los números recién borrados en pantalla.
  const huella = filas.map((f) => `${f.clave}=${f.rige}/${f.proximo}`).join('|') + `@${proximoDesde}`;
  useEffect(() => {
    setValores(inicial());
    setDesde(hoy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella]);

  const cambiado = filas.some((f) => valores[f.clave] !== String(f.rige)) || desde !== hoy;
  // Hay algo cargado a mano: el ajuste por IPC también mueve el precio, pero
  // no hay nada guardado que borrar.
  const movido = tramos.length > 0;

  async function mandar(valor: { tramos: TramoDePrecios[] } | null) {
    setGuardando(true);
    setError(null);
    setListo(false);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'servicios_precios', valor }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setListo(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  function guardar() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      setError('Falta la fecha desde la que rige.');
      return;
    }
    const precios: Record<string, number> = {};
    for (const f of filas) {
      const n = Number(valores[f.clave].replace(/\D/g, ''));
      if (!Number.isInteger(n) || n <= 0) {
        setError(`Falta el precio de ${f.nombre}.`);
        return;
      }
      precios[f.clave] = n;
    }
    // El nuevo tramo reemplaza al de la misma fecha. De los que ya empezaron
    // se guarda solo el último: los anteriores ya no rigen para nada.
    const todos = [...tramos.filter((t) => t.desde !== desde), { desde, precios }].sort((a, b) =>
      a.desde.localeCompare(b.desde)
    );
    const vigente = [...todos].reverse().find((t) => t.desde <= hoy);
    mandar({ tramos: todos.filter((t) => t.desde > hoy || t === vigente) });
  }

  return (
    <section className="os-panel os-servicios-precios">
      <div className="os-panel-top">
        <h2>Otros servicios</h2>
      </div>
      <div className="os-panel-cuerpo">
        <p className="os-columna-nota">
          Coaching, entrevistas y referencias, como salen en la página de precios. Suben solos cada
          trimestre (1/11, 1/2, 1/5 y 1/8) con el IPC acumulado de los tres últimos meses publicados
          por el INDEC, redondeado a $ 5.000. Un precio cargado a mano rige desde la fecha que se
          elige y los ajustes siguientes parten de él.
        </p>
        {(ultimoIpc || !proximoIpc) && (
          <p className="os-columna-nota">
            {ultimoIpc && <>Último ajuste: {dia(ultimoIpc.desde)}, {ipcTexto(ultimoIpc)}. </>}
            {!proximoIpc && !sinIpc && (
              <>Próximo ajuste: {dia(proximoAjuste)}, con el IPC que esté publicado ese día.</>
            )}
          </p>
        )}
        {sinIpc && (
          <p className="os-form-error">
            El ajuste del {dia(sinIpc)} no se aplicó: falta publicar un mes del IPC o la API no
            contestó. Se aplica solo apenas esté.
          </p>
        )}
        <table className="os-tabla">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Unidad</th>
              <th className="os-tabla-num">Precio</th>
              {proximoDesde && (
                <th className="os-tabla-num">
                  Desde el {dia(proximoDesde)}
                  {proximoIpc && <span className="os-servicios-precios-ipc">{ipcTexto(proximoIpc)}</span>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave}>
                <td data-campo="Servicio">{f.nombre}</td>
                <td data-campo="Unidad" className="os-tabla-flojo">
                  {f.unidad}
                </td>
                <td data-campo="Precio" className="os-tabla-num">
                  <input
                    className="os-campo os-servicios-precio"
                    inputMode="numeric"
                    value={valores[f.clave]}
                    onChange={(e) => {
                      setListo(false);
                      setValores((v) => ({ ...v, [f.clave]: e.target.value }));
                    }}
                    aria-label={`Precio de ${f.nombre}`}
                    title={f.rige !== f.deFabrica ? `De fábrica: ${pesos(f.deFabrica)}` : undefined}
                  />
                </td>
                {proximoDesde && (
                  <td data-campo={`Desde el ${dia(proximoDesde)}`} className="os-tabla-num">
                    {f.proximo !== null ? pesos(f.proximo) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="os-form-error">{error}</p>}
        <div className="os-servicios-precios-pie">
          {listo && !cambiado && <span className="os-columna-nota">Guardado.</span>}
          <label className="os-servicios-precios-desde">
            <span className="os-etiqueta-campo">Rige desde</span>
            <input
              className="os-campo"
              type="date"
              value={desde}
              onChange={(e) => {
                setListo(false);
                setDesde(e.target.value);
              }}
            />
          </label>
          {movido && (
            <button
              type="button"
              className="os-boton"
              disabled={guardando}
              onClick={() => mandar(null)}
            >
              Volver a los de fábrica
            </button>
          )}
          <button
            type="button"
            className="os-boton os-boton-firme"
            disabled={guardando || !cambiado}
            onClick={guardar}
          >
            {guardando ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </div>
    </section>
  );
}
