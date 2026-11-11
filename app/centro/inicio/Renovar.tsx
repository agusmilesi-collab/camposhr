'use client';

/**
 * La pregunta del 25: ¿seguís con tus horas el mes que viene?
 *
 * Dos salidas: Sí, de un toque, y "Editar horas", que muestra sus
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
  libres = [],
  sumadas: guardadas = [],
  mirando = false,
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
  /** Las horas libres todas las semanas del mes que viene, por sala y día. */
  libres?: { espacioId: string; sala: string; dia: number; horas: number[] }[];
  /** Las bandas que ya sumó para el mes que viene. */
  sumadas?: { id: string; dia: string; sala: string; desde: number; hasta: number }[];
  /** El equipo mirando su pantalla: lo que se suma se muestra y no se guarda. */
  mirando?: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [texto, setTexto] = useState(nota ?? '');
  const [usa, setUsa] = useState<string[]>(tildados);
  const [deja, setDeja] = useState<{ contrato: string; hora: number }[]>(dejadas);
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diasLibres = [...new Set(libres.map((l) => l.dia))].sort((a, b) => a - b);
  const [diaSuma, setDiaSuma] = useState<number | null>(diasLibres[0] ?? null);
  const salasDelDia = libres.filter((l) => l.dia === diaSuma);
  const [salaSuma, setSalaSuma] = useState<string | null>(salasDelDia[0]?.espacioId ?? null);
  const libre = salasDelDia.find((l) => l.espacioId === salaSuma) ?? salasDelDia[0] ?? null;
  const [elegidas, setElegidas] = useState<number[]>([]);
  // Mirando, lo sumado queda en la pantalla para ver cómo se ve, sin guardarse.
  const [deMuestra, setDeMuestra] = useState<typeof guardadas>([]);
  const sumadas = [...guardadas, ...deMuestra];
  const horasSumadas = sumadas.reduce((n, b) => n + b.hasta - b.desde, 0);

  async function banda(cuerpo: Record<string, unknown>) {
    setError(null);
    if (mirando) {
      if (cuerpo.accion === 'quitar') {
        setDeMuestra((xs) => xs.filter((x) => x.id !== cuerpo.id));
      } else if (libre) {
        const horas = [...elegidas].sort((a, b) => a - b);
        setDeMuestra((xs) => [
          ...xs,
          { id: `muestra-${Date.now()}`, dia: DIAS[diaSuma ?? 0].slice(0, 3), sala: libre.sala, desde: horas[0], hasta: horas[horas.length - 1] + 1 },
        ]);
        setElegidas([]);
      }
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/bandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? 'No se pudo guardar. Probá de nuevo.');
        return;
      }
      setElegidas([]);
      router.refresh();
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

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

  // Mientras edita no está "contestada" aunque ya haya respuesta guardada:
  // sumar una hora la guarda, y si eso cerraba la tarjeta se perdía lo
  // tachado y lo tildado que todavía no había enviado.
  const contestada = abierto || (respuesta !== null && !cambiando && !editando);

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
            ? [
                dejadas.length > 0 ? `${dejadas.length} h no se renuevan` : '',
                horasSumadas > 0 ? `sumás ${horasSumadas} h` : '',
                nota ?? '',
              ]
                .filter(Boolean)
                .join(' · ') ||
              `Para ${mes}`
            : `Para ${mes}`
          : 'Tus mismas horas, un mes más'}
      </small>

      {/* El aviso de los feriados. El Centro cierra esos días, así que su
          sala no se reserva; quien quiere trabajar igual lo tilda y esas horas
          se le suman al mes. Contestado, dice cuáles eligió. */}
      {feriados.length > 0 && respuesta !== 'no' && (
        <div className="centro-renovar-feriados">
          <b className="centro-renovar-titulo">Feriados</b>
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

      {error && !editando && <small className="centro-soltar-error">{error}</small>}

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
              <b className="centro-renovar-titulo">Horas que no renovás</b>
              <span>Tocá las que ya no vas a usar: quedan tachadas.</span>
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
                        title={marcada(b.id, h) ? 'No se renueva. Tocala de nuevo para quedártela.' : undefined}
                      >
                        {h} a {h + 1}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="centro-renovar-bandas centro-renovar-sumar">
            <b className="centro-renovar-titulo">Sumar horas fijas</b>
            <span>
              Todas las semanas, desde el 1 de {mes}. Elegí día y consultorio, y tocá las horas libres.
              Para una hora suelta, usá Reservar.
            </span>


            {libres.length === 0 ? (
              <span>No quedan horas libres para sumar en {mes}.</span>
            ) : (
              <div>
                <div className="centro-renovar-elegir">
                  <select
                    value={diaSuma ?? ''}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setDiaSuma(d);
                      setSalaSuma(libres.find((l) => l.dia === d)?.espacioId ?? null);
                      setElegidas([]);
                    }}
                    aria-label="Día"
                  >
                    {diasLibres.map((d) => (
                      <option key={d} value={d}>
                        {DIAS[d]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={libre?.espacioId ?? ''}
                    onChange={(e) => {
                      setSalaSuma(e.target.value);
                      setElegidas([]);
                    }}
                    aria-label="Consultorio"
                  >
                    {salasDelDia.map((l) => (
                      <option key={l.espacioId} value={l.espacioId}>
                        {l.sala}
                      </option>
                    ))}
                  </select>
                </div>
                <span>
                  {libre?.horas
                    // Lo sumado de muestra deja de ofrecerse, como pasaría guardado.
                    .filter((h) => !deMuestra.some((m) => m.sala === libre.sala && m.dia === DIAS[diaSuma ?? 0].slice(0, 3) && h >= m.desde && h < m.hasta))
                    .map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={elegidas.includes(h) ? 'suma' : undefined}
                      aria-pressed={elegidas.includes(h)}
                      onClick={() =>
                        setElegidas((xs) => (xs.includes(h) ? xs.filter((x) => x !== h) : [...xs, h]))
                      }
                      disabled={enviando}
                    >
                      {h} a {h + 1}
                    </button>
                  ))}
                </span>
                <button
                  type="button"
                  className="centro-renovar-sumar-boton"
                  onClick={() => banda({ accion: 'sumar', espacioId: libre?.espacioId, dia: diaSuma, horas: elegidas, deja, feriados: usa })}
                  disabled={enviando || elegidas.length === 0}
                >
                  {elegidas.length === 0
                    ? 'Tocá las horas que querés sumar'
                    : `Sumar ${elegidas.length} ${elegidas.length === 1 ? 'hora' : 'horas'} los ${DIAS[diaSuma ?? 0].toLowerCase()}`}
                </button>
              </div>
            )}
            {sumadas.length > 0 && (
              <ul className="centro-renovar-sumadas">
                <li className="centro-renovar-sumadas-titulo">
                  {mirando ? 'Sumadas (vista previa: mirando no se guarda)' : 'Ya sumaste'}
                </li>
                {sumadas.map((b) => (
                  <li key={b.id}>
                    <span>
                      {b.dia} · {b.sala} · {b.desde} a {b.hasta}
                    </span>
                    <button type="button" onClick={() => banda({ accion: 'quitar', id: b.id })} disabled={enviando}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <small className="centro-soltar-error">{error}</small>}
          <div className="centro-renovar-botones">
            <button type="button" onClick={() => setEditando(false)} disabled={enviando}>
              Volver
            </button>
            <button
              type="button"
              className="firme"
              // Sin nada marcado ni sumado, enviar es renovar igual: entrar a
              // mirar y no cambiar nada no puede dejar a nadie sin contestar.
              onClick={() => responder(deja.length > 0 || sumadas.length > 0 ? 'cambiar' : 'si')}
              disabled={enviando}
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
          <button type="button" onClick={() => setEditando(true)} disabled={enviando}>
            Editar horas
          </button>
        </div>
      )}
      {/* Sin botón de "No" (decisión de Agustín, 10/11/2026): al lado de
          "Editar horas" se confundía con no renovar algunas horas. Quien no
          renueva el mes lo habla con Lucila, que termina sus bandas desde la ficha. */}
      {!contestada && !editando && (
        <small className="centro-renovar-cerrado">Si no renovás el mes, avisale a Lucila por WhatsApp.</small>
      )}
    </article>
  );
}
