'use client';

/**
 * La cola de pedidos de cambio del OS: arriba el formulario para dejar uno,
 * abajo la tabla con número, fecha, quién lo pidió, qué pide, prioridad y estado.
 *
 * El estado se cambia desde la misma tabla, con el desplegable del OS. Lo
 * abierto (Nuevo, En curso) va arriba; lo cerrado, abajo.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Desplegable from '@/app/os/Desplegable';
import { fechaCorta } from '@/lib/hora';
import {
  ABIERTO,
  COLOR_PRIORIDAD,
  COLOR_TICKET,
  ESTADOS_TICKET,
  LARGO_TICKET,
  PESO_PRIORIDAD,
  PRIORIDADES,
  type EstadoTicket,
  type Prioridad,
  type Ticket,
} from '@/lib/tickets-tipos';

const OPCIONES = ESTADOS_TICKET.map((e) => ({ valor: e, texto: e, color: COLOR_TICKET[e] }));
const OPCIONES_PRIORIDAD = PRIORIDADES.map((p) => ({ valor: p, texto: p, color: COLOR_PRIORIDAD[p] }));

export default function Tickets({ tickets, yo }: { tickets: Ticket[]; yo: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [donde, setDonde] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('Media');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [locales, setLocales] = useState<Record<number, Partial<Pick<Ticket, 'estado' | 'prioridad'>>>>({});

  const ordenados = tickets
    .map((t) => ({ ...t, ...locales[t.numero] }))
    .sort(
      (a, b) =>
        Number(ABIERTO[b.estado]) - Number(ABIERTO[a.estado]) ||
        PESO_PRIORIDAD[b.prioridad] - PESO_PRIORIDAD[a.prioridad] ||
        b.numero - a.numero
    );
  const abiertos = ordenados.filter((t) => ABIERTO[t.estado]).length;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch('/api/os/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, donde, prioridad }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo enviar.');
      setTexto('');
      setDonde('');
      setPrioridad('Media');
      setAviso(`Enviado: ticket N° ${r.fila.numero}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  }

  async function cambiar(numero: number, cambio: Partial<Pick<Ticket, 'estado' | 'prioridad'>>) {
    setLocales((l) => ({ ...l, [numero]: { ...l[numero], ...cambio } }));
    setError(null);
    try {
      const res = await fetch('/api/os/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, ...cambio }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar el cambio.');
      router.refresh();
    } catch (err) {
      setLocales((l) => {
        const { [numero]: _, ...resto } = l;
        return resto;
      });
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  }

  return (
    <>
      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Nuevo ticket</h2>
          <span className="os-columna-monto">Lo pide: {yo}</span>
        </div>
        <form className="os-panel-cuerpo os-ticket-alta" onSubmit={enviar}>
          <label className="os-redaccion">
            <span className="os-etiqueta-campo">Qué pedís</span>
            <textarea
              className="os-campo"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={LARGO_TICKET}
              placeholder="Qué querés que cambie y por qué."
            />
          </label>
          <div className="os-ticket-fila">
            <label className="os-redaccion">
              <span className="os-etiqueta-campo">Dónde (opcional)</span>
              <input
                className="os-campo"
                value={donde}
                onChange={(e) => setDonde(e.target.value)}
                maxLength={200}
                placeholder="Por ejemplo: ficha del candidato, pestaña Informe"
              />
            </label>
            <div className="os-redaccion">
              <span className="os-etiqueta-campo">Prioridad</span>
              <Desplegable
                valor={prioridad}
                opciones={OPCIONES_PRIORIDAD}
                alElegir={(v) => setPrioridad(v as Prioridad)}
                etiqueta="Prioridad del ticket"
                ancho={128}
              />
            </div>
          </div>
          {error && <p className="os-form-error">{error}</p>}
          {aviso && <p className="os-ticket-aviso">{aviso}</p>}
          <div>
            <button className="os-boton os-boton-firme" type="submit" disabled={enviando || !texto.trim()}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </section>

      <section className="os-panel os-ticket-cola">
        <div className="os-panel-top">
          <h2>Cola de tickets</h2>
          <span className="os-columna-monto">
            {abiertos} {abiertos === 1 ? 'abierto' : 'abiertos'}
          </span>
        </div>
        {ordenados.length === 0 ? (
          <p className="os-vacio">Todavía no hay tickets.</p>
        ) : (
          <div className="os-tabla-marco">
            <table className="os-tabla os-tabla-tickets">
              <thead>
                <tr>
                  <th className="os-tabla-num">N°</th>
                  <th>Fecha</th>
                  <th>Pidió</th>
                  <th>Qué pide</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((t) => (
                  <tr key={t.numero} className={ABIERTO[t.estado] ? undefined : 'os-ticket-cerrado'}>
                    <td data-campo="N°" className="os-tabla-num">
                      {t.numero}
                    </td>
                    <td data-campo="Fecha">{fechaCorta(t.created_at)}</td>
                    <td data-campo="Pidió">{t.pide}</td>
                    <td data-campo="Qué pide" className="os-ticket-texto">
                      {t.texto}
                      {t.donde && <span className="os-ticket-donde">{t.donde}</span>}
                      <Respuesta texto={t.respuesta} />
                    </td>
                    <td data-campo="Prioridad">
                      <Desplegable
                        valor={t.prioridad}
                        opciones={OPCIONES_PRIORIDAD}
                        alElegir={(v) => cambiar(t.numero, { prioridad: v as Prioridad })}
                        etiqueta={`Prioridad del ticket ${t.numero}`}
                        ancho={110}
                      />
                    </td>
                    <td data-campo="Estado">
                      <Desplegable
                        valor={t.estado}
                        opciones={OPCIONES}
                        alElegir={(v) => cambiar(t.numero, { estado: v as EstadoTicket })}
                        etiqueta={`Estado del ticket ${t.numero}`}
                        ancho={128}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Qué se hizo con el pedido, plegado debajo del pedido mismo. La escribe quien
 * resuelve el ticket (un agente, por la ruta o la base); desde la pantalla solo
 * se lee. Sin respuesta, no se dibuja nada.
 */
function Respuesta({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <details className="os-ticket-respuesta">
      <summary>Ver respuesta</summary>
      <p>{texto}</p>
    </details>
  );
}
