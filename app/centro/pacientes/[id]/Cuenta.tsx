'use client';
/**
 * La cuenta corriente del paciente: el costo de la consulta, y por cada
 * turno qué día fue, cuánto era y si lo pagó. Nada más que eso: no es una
 * facturación, es la libreta donde la profesional anota si le pagaron.
 *
 * El costo se guarda al salir del campo. El pago se marca con un toque y
 * congela el importe de ese día; desmarcarlo lo libera.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type TurnoCuenta = {
  id: string;
  fecha: string;
  hora: number;
  pagado: boolean;
  /** Lo que se cobró el día que se marcó pagado; null si no se marcó. */
  cobrado: number | null;
};

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

export default function Cuenta({
  pacienteId,
  precio,
  turnos,
  hoy,
}: {
  pacienteId: string;
  precio: number | null;
  turnos: TurnoCuenta[];
  hoy: string;
}) {
  const router = useRouter();
  const [costo, setCosto] = useState(precio === null ? '' : String(precio));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  async function guardarCosto() {
    const n = costo.trim() === '' ? null : Number(costo.replace(',', '.'));
    if (n !== null && (!Number.isFinite(n) || n < 0)) return setError('El costo va en números.');
    if (n === precio) return;
    setGuardando('costo');
    setError(null);
    const res = await fetch('/api/centro/pacientes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pacienteId, precio_consulta: n === null ? '' : String(n) }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(null);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    router.refresh();
  }

  async function marcar(t: TurnoCuenta, pagado: boolean) {
    setGuardando(t.id);
    setError(null);
    const res = await fetch('/api/centro/turnos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, pagado, importe: pagado ? (precio ?? 0) : null }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(null);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    router.refresh();
  }

  // Solo lo que ya pasó o es hoy: un turno de la semana que viene no debe nada.
  const vencidos = turnos.filter((t) => t.fecha <= hoy);
  const importeDe = (t: TurnoCuenta) => (t.pagado ? (t.cobrado ?? precio ?? 0) : (precio ?? 0));
  const cobrado = vencidos.filter((t) => t.pagado).reduce((n, t) => n + importeDe(t), 0);
  const pendiente = vencidos.filter((t) => !t.pagado).reduce((n, t) => n + importeDe(t), 0);

  return (
    <>
      {error && <p className="centro-error">{error}</p>}
      <section className="centro-panel">
        <h2>Pagos</h2>
        <div className="centro-cuenta-costo">
          <label>
            Costo de la consulta
            <input
              className="centro-campo"
              inputMode="decimal"
              placeholder="Sin cargar"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              onBlur={guardarCosto}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              disabled={guardando === 'costo'}
            />
          </label>
          <dl className="centro-cuenta-totales">
            <div>
              <dt>Cobrado</dt>
              <dd>{pesos(cobrado)}</dd>
            </div>
            <div className={pendiente > 0 ? 'debe' : undefined}>
              <dt>Pendiente</dt>
              <dd>{pesos(pendiente)}</dd>
            </div>
          </dl>
        </div>

        {vencidos.length === 0 ? (
          <p className="centro-nota">Todavía no tuvo consultas.</p>
        ) : (
          <table className="centro-resumen">
            <thead>
              <tr>
                <th>Día</th>
                <th>Hora</th>
                <th className="centro-num">Importe</th>
                <th className="centro-num">Pagó</th>
              </tr>
            </thead>
            <tbody>
              {vencidos.map((t) => (
                <tr key={t.id} className={t.pagado ? undefined : 'centro-cuenta-debe'}>
                  <td>{dia(t.fecha)}</td>
                  <td>{String(t.hora).padStart(2, '0')}:00</td>
                  <td className="centro-num">{precio === null && !t.pagado ? '—' : pesos(importeDe(t))}</td>
                  <td className="centro-num">
                    <button
                      type="button"
                      className={`centro-activo${t.pagado ? ' si' : ''}`}
                      role="switch"
                      aria-checked={t.pagado}
                      title={t.pagado ? 'Pagó. Tocá para desmarcar' : 'No pagó. Tocá para marcar que pagó'}
                      onClick={() => marcar(t, !t.pagado)}
                      disabled={guardando === t.id}
                    >
                      <i />
                      {t.pagado ? 'Sí' : 'No'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
