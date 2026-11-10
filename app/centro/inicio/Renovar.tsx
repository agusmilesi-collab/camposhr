'use client';

/**
 * La pregunta del 25: ¿seguís con tus horas el mes que viene?
 *
 * Tres salidas. Sí y No se contestan de un toque. "Editar horas" muestra sus
 * horas fijas, una por una, y se tocan las que deja: eso se aplica solo al
 * abrirse el mes (`lib/apertura-mes.ts`). Lo que quiere sumar se escribe,
 * porque depende de qué esté libre y lo arma el equipo. Hasta el 10/11/2026
 * todo era texto, y un "dejo el viernes 18hs" quedaba esperando a que alguien
 * lo interpretara.
 *
 * Con el mes ya abierto la respuesta no se cambia desde acá: las reservas y
 * los cargos ya se generaron, y lo que haga falta lo resuelve el equipo.
 *
 * Contestada, la tarjeta dice qué contestó y deja cambiarlo: quien dijo que no
 * el 25 y el 28 consiguió un paciente tiene que poder volver atrás.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Respuesta = 'si' | 'no' | 'cambiar';

const DICHO: Record<Respuesta, string> = {
  si: 'Renovás tus horas',
  no: 'No renovás',
  cambiar: 'Pediste cambiar horas',
};

export default function Renovar({
  mes,
  horas,
  respuesta,
  nota,
  feriados = [],
  tildados = [],
  bandas = [],
  dejadas = [],
  abierto = false,
}: {
  /** El mes que se renueva, escrito: "noviembre". */
  mes: string;
  /** Cuántas horas por semana tiene hoy. */
  horas: number;
  respuesta: Respuesta | null;
  nota: string | null;
  /** Los feriados del mes que viene que caen en sus días. */
  feriados?: { fecha: string; nombre: string; dia: string; horas: number }[];
  /** Los que ya dijo que quiere usar. */
  tildados?: string[];
  /** Sus horas fijas del mes que viene, para tocar las que deja. */
  bandas?: { id: string; dia: string; sala: string; desde: number; hasta: number }[];
  /** Las que ya marcó que deja. */
  dejadas?: { contrato: string; hora: number }[];
  /** Si el mes ya se abrió: la respuesta queda como está. */
  abierto?: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [texto, setTexto] = useState(nota ?? '');
  const [usa, setUsa] = useState<string[]>(tildados);
  const [deja, setDeja] = useState<{ contrato: string; hora: number }[]>(dejadas);
  const marcada = (contrato: string, h: number) => deja.some((d) => d.contrato === contrato && d.hora === h);
  const alternar = (contrato: string, h: number) =>
    setDeja((xs) =>
      marcada(contrato, h) ? xs.filter((d) => !(d.contrato === contrato && d.hora === h)) : [...xs, { contrato, hora: h }]
    );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responder(r: Respuesta) {
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/renovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta: r, nota: texto, feriados: usa, deja: r === 'cambiar' ? deja : [] }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? 'No se pudo guardar. Probá de nuevo.');
        return;
      }
      setEditando(false);
      setCambiando(false);
      router.refresh();
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const contestada = (respuesta !== null && !cambiando) || abierto;

  return (
    // Con feriados la tarjeta crece: hay que poder leerlos y tildarlos.
    <article
      className={`centro-tarjeta centro-renovar${editando || feriados.length > 0 ? ' abierta' : ''}`}
    >
      <div className="centro-tarjeta-top">
        <b>{contestada ? (respuesta ? DICHO[respuesta] : 'Renovás tus horas') : `¿Renovás ${mes}?`}</b>
        <span>{horas} h por semana</span>
      </div>
      <small title={contestada && respuesta === 'cambiar' ? (nota ?? undefined) : undefined}>
        {contestada
          ? respuesta === 'cambiar'
            ? [dejadas.length > 0 ? `Dejás ${dejadas.length} h` : '', nota ?? ''].filter(Boolean).join(' · ') ||
              `Para ${mes}`
            : `Para ${mes}`
          : 'Tus mismas horas, un mes más'}
      </small>

      {/* El aviso de los feriados. El Centro cierra esos días, así que su
          sala no se reserva; quien quiere trabajar igual lo tilda y esas horas
          se le suman al mes. Contestado, dice cuáles eligió. */}
      {feriados.length > 0 && respuesta !== 'no' && (
        <div className="centro-renovar-feriados">
          <span>
            {feriados.length === 1 ? `En ${mes} hay un feriado` : `En ${mes} hay feriados`} en tus
            días. El Centro cierra los feriados.
            {!contestada && ' Si querés usar tu consultorio igual, tildalo y se te suman esas horas.'}
          </span>
          {feriados.map((f) => (
            <label key={f.fecha}>
              <input
                type="checkbox"
                checked={usa.includes(f.fecha)}
                disabled={contestada || enviando}
                onChange={() =>
                  setUsa((xs) => (xs.includes(f.fecha) ? xs.filter((x) => x !== f.fecha) : [...xs, f.fecha]))
                }
              />
              <span>
                <b>{f.dia}</b> · {f.nombre}
                <small>
                  {usa.includes(f.fecha) ? `Lo usás: se suman ${f.horas} h` : `${f.horas} h que no se reservan`}
                </small>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <small className="centro-soltar-error">{error}</small>}

      {abierto ? (
        <small className="centro-renovar-cerrado">
          {mes.charAt(0).toUpperCase() + mes.slice(1)} ya está abierto. Para cambiar algo, escribile a Lucila.
        </small>
      ) : contestada ? (
        <button type="button" className="centro-bajar centro-abrir" onClick={() => setCambiando(true)}>
          Cambiar la respuesta
        </button>
      ) : editando ? (
        <>
          {bandas.length > 0 && (
            <div className="centro-renovar-bandas">
              <span>Tocá las horas que dejás.</span>
              {bandas.map((b) => (
                <div key={b.id}>
                  <b>
                    {b.dia} · {b.sala}
                  </b>
                  <span>
                    {Array.from({ length: b.hasta - b.desde }, (_, n) => b.desde + n).map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={marcada(b.id, h) ? 'deja' : undefined}
                        aria-pressed={marcada(b.id, h)}
                        onClick={() => alternar(b.id, h)}
                        disabled={enviando}
                        title={`${h} a ${h + 1}`}
                      >
                        {h}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          <textarea
            className="centro-renovar-nota"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Querés sumar horas? Contanos cuáles: lo arma Lucila según lo que esté libre."
          />
          <div className="centro-renovar-botones">
            <button type="button" onClick={() => setEditando(false)} disabled={enviando}>
              Volver
            </button>
            <button
              type="button"
              className="firme"
              onClick={() => responder('cambiar')}
              disabled={enviando || (texto.trim() === '' && deja.length === 0)}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </>
      ) : (
        <div className="centro-renovar-botones">
          <button type="button" className="firme" onClick={() => responder('si')} disabled={enviando}>
            Sí
          </button>
          <button type="button" onClick={() => responder('no')} disabled={enviando}>
            No
          </button>
          <button type="button" onClick={() => setEditando(true)} disabled={enviando}>
            Editar horas
          </button>
        </div>
      )}
    </article>
  );
}
