'use client';
/**
 * La agenda: un día por bloque, adentro cada hora reservada con su sala y un
 * campo para el nombre de quien se atiende.
 *
 * Se escribe directo en la fila y se guarda al salir del campo o con Enter:
 * son muchos renglones iguales y abrir un formulario por cada uno es lo que
 * hace que la agenda se siga llevando en un papel. Borrar el nombre y salir
 * borra el turno.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DIAS_CORTOS, diaSemanaDe, hora as horaDe } from '@/lib/consultorios-calculo';

type Reserva = { id: string; fecha: string; desde: string; hasta: string; sala: string };
type Turno = { fecha: string; hora: number; paciente: string; nota: string | null; pacienteId: string | null };

function larga(iso: string): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  return `${DIAS_CORTOS[diaSemanaDe(iso)] ?? 'Dom'} ${new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
  }).format(d)}`;
}

export default function Turnos({
  hoy,
  reservas,
  turnos,
  pacientes,
}: {
  hoy: string;
  reservas: Reserva[];
  turnos: Turno[];
  pacientes: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  /** Lo escrito y todavía no guardado, por "fecha|hora". */
  const [borrador, setBorrador] = useState<Record<string, { paciente: string; nota: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const clave = (fecha: string, h: number) => `${fecha}|${h}`;
  const guardado = new Map(turnos.map((t) => [clave(t.fecha, t.hora), t]));

  /** Las horas de reloj de cada día, con su sala: la reserva de 9 a 12 son tres. */
  const dias = new Map<string, { hora: number; sala: string }[]>();
  for (const r of reservas) {
    const lista = dias.get(r.fecha) ?? [];
    for (let h = horaDe(r.desde); h < horaDe(r.hasta); h++) lista.push({ hora: h, sala: r.sala });
    dias.set(r.fecha, lista.sort((a, b) => a.hora - b.hora));
  }
  const fechas = [...dias.keys()].sort();
  const pasadas = fechas.filter((f) => f < hoy);
  const proximas = fechas.filter((f) => f >= hoy);

  function valorDe(fecha: string, h: number) {
    const k = clave(fecha, h);
    const b = borrador[k];
    if (b) return b;
    const t = guardado.get(k);
    return { paciente: t?.paciente ?? '', nota: t?.nota ?? '' };
  }

  function escribir(fecha: string, h: number, cambio: Partial<{ paciente: string; nota: string }>) {
    const k = clave(fecha, h);
    setBorrador((prev) => ({ ...prev, [k]: { ...valorDe(fecha, h), ...cambio } }));
  }

  async function guardar(fecha: string, h: number) {
    const k = clave(fecha, h);
    const b = borrador[k];
    if (!b) return;
    const antes = guardado.get(k);
    const paciente = b.paciente.trim();
    const nota = b.nota.trim();
    // Sin cambios, no se manda nada.
    if (paciente === (antes?.paciente ?? '') && nota === (antes?.nota ?? '')) {
      setBorrador((prev) => {
        const { [k]: _, ...resto } = prev;
        return resto;
      });
      return;
    }
    setGuardando(k);
    setError(null);
    const res = await fetch('/api/centro/turnos', {
      method: paciente ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, hora: h, paciente, nota }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(null);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setBorrador((prev) => {
      const { [k]: _, ...resto } = prev;
      return resto;
    });
    router.refresh();
  }

  // Una función que devuelve el bloque del día, y no un componente definido
  // acá adentro: un componente creado en cada render es para React uno nuevo
  // cada vez, y desmonta los campos con cada tecla. Así el campo perdía el
  // foco al primer carácter y nunca llegaba a guardar.
  const dia = (fecha: string) => (
    <section key={fecha} className={`centro-panel centro-agenda-dia${fecha < hoy ? ' centro-agenda-pasado' : ''}`}>
      <h2>
        {larga(fecha)}
        {fecha === hoy && <span className="centro-agenda-hoy">hoy</span>}
      </h2>
      <ul className="centro-agenda-horas">
        {(dias.get(fecha) ?? []).map(({ hora: h, sala }) => {
          const k = clave(fecha, h);
          const v = valorDe(fecha, h);
          return (
            <li key={k} className={v.paciente ? 'con-turno' : undefined}>
              <span className="centro-agenda-hora">{String(h).padStart(2, '0')}:00</span>
              <span className="centro-agenda-sala">{sala.replace('Consultorio ', 'Cons. ')}</span>
              <input
                className="centro-agenda-paciente"
                list="centro-pacientes"
                placeholder="Libre"
                value={v.paciente}
                aria-label={`Paciente de las ${h}:00 del ${larga(fecha)}`}
                onChange={(e) => escribir(fecha, h, { paciente: e.target.value })}
                onBlur={() => guardar(fecha, h)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                disabled={guardando === k}
              />
              {/* La ficha del paciente, como ícono: una tarjeta con la
                  persona. En azul y con enlace cuando el turno está atado a
                  una ficha; en gris, sin enlace, cuando no. */}
              {(() => {
                const fichaId = !borrador[k] ? guardado.get(k)?.pacienteId : undefined;
                const dibujo = (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <circle cx="9" cy="11" r="2.2" />
                    <path d="M5.5 16.5c.6-1.8 1.9-2.7 3.5-2.7s2.9.9 3.5 2.7M14.5 10h4M14.5 13.5h4" />
                  </svg>
                );
                return fichaId ? (
                  <Link
                    href={`/centro/pacientes/${fichaId}`}
                    className="centro-icono centro-agenda-ficha"
                    title="Abrir la ficha"
                    aria-label={`Abrir la ficha de ${v.paciente}`}
                  >
                    {dibujo}
                  </Link>
                ) : (
                  <span className="centro-icono centro-agenda-ficha sin-ficha" title="Sin ficha" aria-hidden="true">
                    {dibujo}
                  </span>
                );
              })()}
              <input
                className="centro-agenda-nota"
                placeholder="Nota"
                value={v.nota}
                aria-label="Nota"
                onChange={(e) => escribir(fecha, h, { nota: e.target.value })}
                onBlur={() => guardar(fecha, h)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                disabled={guardando === k}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <main className="centro-cuerpo">
      <h1 className="centro-titulo">Mis turnos</h1>
      {error && <p className="centro-error">{error}</p>}

      <datalist id="centro-pacientes">
        {pacientes.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {proximas.length === 0 && (
        <div className="centro-panel">
          <p className="centro-nota" style={{ margin: 0 }}>
            No tenés horas reservadas en las próximas cinco semanas.
          </p>
        </div>
      )}
      {proximas.map((f) => dia(f))}

      {pasadas.length > 0 && (
        <>
          <h2 className="centro-agenda-seccion">Última semana</h2>
          {pasadas.reverse().map((f) => dia(f))}
        </>
      )}
    </main>
  );
}
