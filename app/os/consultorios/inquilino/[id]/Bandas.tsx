'use client';

/**
 * Las horas fijas de una persona, con alta y fin.
 *
 * Hasta el 10/11/2026 las bandas se cargaban con un script, así que un "sumo
 * el jueves de 14 a 18" quedaba esperando a que alguien con la computadora lo
 * pasara. Ahora Lucila las agrega y las termina desde acá.
 *
 * Una banda no se edita: se termina y se agrega otra. Así la historia dice qué
 * alquilaba cada uno en cada mes, que es de donde sale lo que se le cobró.
 *
 * Agregar en un mes ya abierto le genera las reservas que le tocan desde ese
 * día; terminar cancela las que ya se habían generado después del fin, con su
 * cargo (`lib/apertura-mes.ts`).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DIAS_CORTOS,
  finDeMes,
  hora,
  mesCorrido,
  periodoDe,
  type Contrato,
  type Espacio,
} from '@/lib/consultorios-calculo';

/** Los controles en fila. La hoja del OS no tiene una clase para esto y está
 *  tocada por otra sesión: va acá. */
const FILA = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as const;

const HORAS = Array.from({ length: 14 }, (_, n) => n + 8); // 8 a 21

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

export default function Bandas({
  inquilinoId,
  contratos,
  espacios,
  hoy,
}: {
  inquilinoId: string;
  contratos: Contrato[];
  espacios: Espacio[];
  hoy: string;
}) {
  const router = useRouter();
  const salas = espacios.filter((e) => e.activo && e.tipo === 'consultorio');
  const salaDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';
  // Las que rigen hoy y las que empiezan más adelante.
  const vivas = contratos.filter((c) => c.vigente_hasta === null || c.vigente_hasta >= hoy);

  const [agregando, setAgregando] = useState(false);
  const [terminando, setTerminando] = useState<string | null>(null);
  const [hasta, setHasta] = useState(finDeMes(periodoDe(hoy)));
  const [nueva, setNueva] = useState({
    dia: 0,
    espacioId: salas[0]?.id ?? '',
    desde: 9,
    hastaHora: 10,
    vigenteDesde: mesCorrido(periodoDe(hoy), 1),
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function mandar(cuerpo: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setError(null);
    setHecho(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/os/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? `No se pudo guardar (error ${res.status}).`);
        return null;
      }
      router.refresh();
      return d;
    } catch {
      setError('No se pudo guardar: se cortó la conexión.');
      return null;
    } finally {
      setEnviando(false);
    }
  }

  async function agregar() {
    const d = await mandar({
      accion: 'contrato-alta',
      inquilinoId,
      espacioId: nueva.espacioId,
      dia: nueva.dia,
      desdeHora: `${String(nueva.desde).padStart(2, '0')}:00`,
      hastaHora: `${String(nueva.hastaHora).padStart(2, '0')}:00`,
      desde: nueva.vigenteDesde,
    });
    if (!d) return;
    setAgregando(false);
    const n = Number(d.reservas ?? 0);
    setHecho(n > 0 ? `Banda agregada. El mes ya estaba abierto: se generaron ${n} reservas.` : 'Banda agregada.');
  }

  async function terminar(id: string) {
    const d = await mandar({ accion: 'contrato-baja', id, hasta });
    if (!d) return;
    setTerminando(null);
    const n = Number(d.canceladas ?? 0);
    setHecho(n > 0 ? `Banda terminada. Se cancelaron ${n} reservas posteriores, con su cargo.` : 'Banda terminada.');
  }

  return (
    <>
      {vivas.length === 0 ? (
        <p className="os-vacio">Hoy no tiene horas fijas. Lo que reserve va como hora suelta.</p>
      ) : (
        <table className="os-tabla os-tabla-fija">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Día</th>
              <th>Sala</th>
              <th>Horario</th>
              <th className="os-tabla-num">Horas</th>
              <th>Rige</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vivas.map((c) => (
              <tr key={c.id}>
                <td data-campo="Día">{DIAS_CORTOS[c.dia_semana]}</td>
                <td data-campo="Sala">{salaDe(c.espacio_id)}</td>
                <td data-campo="Horario">
                  {c.desde_hora.slice(0, 5)} a {c.hasta_hora.slice(0, 5)}
                </td>
                <td data-campo="Horas" className="os-tabla-num">
                  {hora(c.hasta_hora) - hora(c.desde_hora)} h
                </td>
                <td data-campo="Rige">
                  {c.vigente_hasta ? `${dia(c.vigente_desde)} al ${dia(c.vigente_hasta)}` : `Desde ${dia(c.vigente_desde)}`}
                </td>
                <td data-campo="">
                  {terminando === c.id ? (
                    <span style={FILA}>
                      <input
                        type="date"
                        className="os-campo"
                        value={hasta}
                        min={c.vigente_desde}
                        onChange={(e) => setHasta(e.target.value)}
                        aria-label="Último día"
                      />
                      <button type="button" className="os-boton os-boton-peligro" disabled={enviando} onClick={() => terminar(c.id)}>
                        Terminar
                      </button>
                      <button type="button" className="os-boton" onClick={() => setTerminando(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    !c.vigente_hasta && (
                      <button type="button" className="os-boton" onClick={() => setTerminando(c.id)}>
                        Terminar
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {agregando ? (
        <div className="os-panel-nota" style={FILA}>
          <select
            className="os-campo"
            value={nueva.dia}
            onChange={(e) => setNueva({ ...nueva, dia: Number(e.target.value) })}
            aria-label="Día"
          >
            {DIAS_CORTOS.slice(0, 5).map((d, n) => (
              <option key={d} value={n}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="os-campo"
            value={nueva.espacioId}
            onChange={(e) => setNueva({ ...nueva, espacioId: e.target.value })}
            aria-label="Sala"
          >
            {salas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <select
            className="os-campo"
            value={nueva.desde}
            onChange={(e) => {
              const desde = Number(e.target.value);
              setNueva({ ...nueva, desde, hastaHora: Math.max(nueva.hastaHora, desde + 1) });
            }}
            aria-label="Desde"
          >
            {HORAS.slice(0, -1).map((h) => (
              <option key={h} value={h}>
                de {h}
              </option>
            ))}
          </select>
          <select
            className="os-campo"
            value={nueva.hastaHora}
            onChange={(e) => setNueva({ ...nueva, hastaHora: Number(e.target.value) })}
            aria-label="Hasta"
          >
            {HORAS.filter((h) => h > nueva.desde).map((h) => (
              <option key={h} value={h}>
                a {h}
              </option>
            ))}
          </select>
          <label className="os-form-nota" style={{ margin: 0 }}>
            desde{' '}
            <input
              type="date"
              className="os-campo"
              value={nueva.vigenteDesde}
              onChange={(e) => setNueva({ ...nueva, vigenteDesde: e.target.value })}
            />
          </label>
          <button type="button" className="os-boton os-boton-firme" disabled={enviando} onClick={agregar}>
            {enviando ? 'Guardando…' : 'Agregar'}
          </button>
          <button type="button" className="os-boton" onClick={() => setAgregando(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="os-panel-nota">
          <button type="button" className="os-boton" onClick={() => setAgregando(true)}>
            Agregar banda
          </button>
        </div>
      )}

      {hecho && <p className="os-panel-nota">{hecho}</p>}
      {error && <p className="os-panel-nota os-form-error">{error}</p>}
    </>
  );
}
