'use client';
/**
 * La agenda como calendario: la semana en una grilla de horas por día, o el
 * mes en una grilla de días. En las dos, cada hora reservada es un campo para
 * escribir a quién se atiende; lo que no está reservado va en gris, porque no
 * tiene sala.
 *
 * Se escribe directo en la celda y se guarda al salir del campo o con Enter:
 * son muchas celdas iguales y abrir un formulario por cada una es lo que hace
 * que la agenda se siga llevando en un papel. Borrar el nombre y salir borra
 * el turno.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DIAS_CORTOS,
  diaSemanaDe,
  hora as horaDe,
  mesCorrido,
  mesLargo,
  periodoDe,
  sumarDias,
} from '@/lib/consultorios-calculo';

const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type Reserva = { id: string; fecha: string; desde: string; hasta: string; sala: string };
type Turno = { fecha: string; hora: number; paciente: string; pacienteId: string | null };

/** El lunes de la semana de una fecha. */
function lunesDe(iso: string): string {
  return sumarDias(iso, -diaSemanaDe(iso));
}

function diaNumero(iso: string): number {
  return Number(iso.slice(8, 10));
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
  const [vista, setVista] = useState<'semana' | 'mes'>('semana');
  /** La fecha que ancla lo que se mira: su semana o su mes. */
  const [ancla, setAncla] = useState(hoy);
  const [error, setError] = useState<string | null>(null);
  /** Lo escrito y todavía no guardado, por "fecha|hora". */
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const clave = (fecha: string, h: number) => `${fecha}|${h}`;
  const guardado = new Map(turnos.map((t) => [clave(t.fecha, t.hora), t]));

  /** La sala de cada hora reservada, por "fecha|hora". */
  const reservada = new Map<string, string>();
  for (const r of reservas) {
    for (let h = horaDe(r.desde); h < horaDe(r.hasta); h++) reservada.set(clave(r.fecha, h), r.sala);
  }

  function valorDe(fecha: string, h: number): string {
    const k = clave(fecha, h);
    return borrador[k] ?? guardado.get(k)?.paciente ?? '';
  }

  function escribir(fecha: string, h: number, paciente: string) {
    setBorrador((prev) => ({ ...prev, [clave(fecha, h)]: paciente }));
  }

  async function guardar(fecha: string, h: number) {
    const k = clave(fecha, h);
    const b = borrador[k];
    if (b === undefined) return;
    const paciente = b.trim();
    const olvidar = () =>
      setBorrador((prev) => {
        const { [k]: _, ...resto } = prev;
        return resto;
      });
    // Sin cambios, no se manda nada.
    if (paciente === (guardado.get(k)?.paciente ?? '')) return olvidar();
    setGuardando(k);
    setError(null);
    const res = await fetch('/api/centro/turnos', {
      method: paciente ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, hora: h, paciente, nota: '' }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(null);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    olvidar();
    router.refresh();
  }

  // ------------------------------------------------------------ qué se mira
  const lunes = lunesDe(ancla);
  const periodo = periodoDe(ancla);
  /** Los días de la semana que se mira: lunes a viernes, y el sábado si ese
   *  sábado tiene algo reservado. */
  const diasDeSemana = (l: string) => {
    const base = [0, 1, 2, 3, 4].map((i) => sumarDias(l, i));
    const sabado = sumarDias(l, 5);
    return [...reservada.keys()].some((k) => k.startsWith(sabado)) ? [...base, sabado] : base;
  };
  const semana = diasDeSemana(lunes);
  /** Las semanas del mes, cada una con sus días. */
  const semanasDelMes: string[][] = [];
  for (let l = lunesDe(periodo); l <= sumarDias(mesCorrido(periodo, 1), -1); l = sumarDias(l, 7)) {
    semanasDelMes.push(diasDeSemana(l));
  }

  const titulo =
    vista === 'semana'
      ? `Semana del ${diaNumero(lunes)} al ${diaNumero(semana[semana.length - 1])} de ${mesLargo(semana[semana.length - 1]).split(' ')[0]}`
      : mesLargo(periodo).replace(/^./, (c) => c.toUpperCase());

  const mover = (n: number) =>
    setAncla(vista === 'semana' ? sumarDias(ancla, 7 * n) : mesCorrido(periodo, n));

  // ----------------------------------------------------------- una celda
  const fichaDe = (fecha: string, h: number) => {
    const k = clave(fecha, h);
    return borrador[k] === undefined ? guardado.get(k)?.pacienteId : undefined;
  };
  const dibujoFicha = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.5 16.5c.6-1.8 1.9-2.7 3.5-2.7s2.9.9 3.5 2.7M14.5 10h4M14.5 13.5h4" />
    </svg>
  );
  const celda = (fecha: string, h: number) => {
    const k = clave(fecha, h);
    const sala = reservada.get(k);
    if (!sala) return <td key={k} className="centro-cal-celda fuera" />;
    const v = valorDe(fecha, h);
    const fichaId = fichaDe(fecha, h);
    return (
      <td key={k} className={`centro-cal-celda${v ? ' con-turno' : ''}`}>
        <input
          className="centro-cal-paciente"
          list="centro-pacientes"
          placeholder="Libre"
          value={v}
          title={sala}
          aria-label={`Paciente de las ${h}:00 del ${fecha}`}
          onChange={(e) => escribir(fecha, h, e.target.value)}
          onBlur={() => guardar(fecha, h)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          disabled={guardando === k}
        />
        {fichaId && (
          <Link href={`/centro/pacientes/${fichaId}`} className="centro-cal-ficha" title="Abrir la ficha">
            {dibujoFicha}
          </Link>
        )}
        <span className="centro-cal-sala">{sala.replace('Consultorio ', 'C')}</span>
      </td>
    );
  };

  return (
    <main className="centro-cuerpo centro-cuerpo-ancho">
      <h1 className="centro-titulo">Mis turnos</h1>
      {error && <p className="centro-error">{error}</p>}

      <datalist id="centro-pacientes">
        {pacientes.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="centro-panel centro-cal">
        <div className="centro-cal-top">
          <h2>{titulo}</h2>
          <div className="centro-cal-controles">
            <div className="centro-cal-vistas" role="tablist">
              <button type="button" className={vista === 'semana' ? 'activa' : undefined} onClick={() => setVista('semana')}>
                Semana
              </button>
              <button type="button" className={vista === 'mes' ? 'activa' : undefined} onClick={() => setVista('mes')}>
                Mes
              </button>
            </div>
            <div className="centro-cal-nav">
              <button type="button" onClick={() => mover(-1)} aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}>
                ‹
              </button>
              <button type="button" onClick={() => setAncla(hoy)}>
                Hoy
              </button>
              <button type="button" onClick={() => mover(1)} aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}>
                ›
              </button>
            </div>
          </div>
        </div>

        {vista === 'semana' ? (
          /* La semana se lee por lo que hay reservado: un bloque por día y
             adentro una fila por hora con sala. Lo que no está reservado no
             se dibuja, que no tiene sala; un día sin horas lo dice en una
             línea. Es la misma lista que la agenda de Inicio. */
          <div className="centro-cal-agenda">
            {semana.map((f) => {
              const horasDia = [...reservada.keys()]
                .filter((k) => k.startsWith(f))
                .map((k) => Number(k.split('|')[1]))
                .sort((x, y) => x - y);
              return (
                <section
                  key={f}
                  className={`centro-agenda-dia${f < hoy ? ' centro-agenda-pasado' : ''}${horasDia.length === 0 ? ' sin-horas' : ''}`}
                >
                  <h2>
                    {DIAS_LARGOS[diaSemanaDe(f)]} {diaNumero(f)}
                    {f === hoy && <span className="centro-agenda-hoy">Hoy</span>}
                  </h2>
                  {horasDia.length === 0 ? (
                    <p className="centro-agenda-vacio">Sin horas reservadas</p>
                  ) : (
                    <ul className="centro-agenda-horas">
                      {horasDia.map((h) => {
                        const k = clave(f, h);
                        const v = valorDe(f, h);
                        const fichaId = fichaDe(f, h);
                        return (
                          <li key={k} className={v ? 'con-turno' : undefined}>
                            <span className="centro-agenda-hora">{String(h).padStart(2, '0')}:00</span>
                            <span className="centro-agenda-sala">{reservada.get(k)}</span>
                            <input
                              className="centro-agenda-paciente"
                              list="centro-pacientes"
                              placeholder="Libre"
                              value={v}
                              aria-label={`Paciente de las ${h}:00 del ${f}`}
                              onChange={(e) => escribir(f, h, e.target.value)}
                              onBlur={() => guardar(f, h)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              disabled={guardando === k}
                            />
                            {fichaId ? (
                              <Link href={`/centro/pacientes/${fichaId}`} className="centro-agenda-ficha" title="Abrir la ficha">
                                {dibujoFicha}
                              </Link>
                            ) : (
                              <span className="centro-agenda-ficha sin-ficha" aria-hidden="true">
                                {dibujoFicha}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="centro-cal-marco">
            <table className="centro-cal-mes">
              <thead>
                <tr>
                  {semanasDelMes[0].map((f) => (
                    <th key={f}>{DIAS_CORTOS[diaSemanaDe(f)]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanasDelMes.map((dias) => (
                  <tr key={dias[0]}>
                    {dias.map((f) => {
                      const delMes = f.slice(0, 7) === periodo.slice(0, 7);
                      const todas = [...reservada.keys()]
                        .filter((k) => k.startsWith(f))
                        .map((k) => Number(k.split('|')[1]))
                        .sort((a, b) => a - b);
                      return (
                        <td
                          key={f}
                          className={`centro-cal-dia${delMes ? '' : ' otro-mes'}${f === hoy ? ' hoy' : ''}${f < hoy ? ' pasado' : ''}`}
                        >
                          {/* El número abre la semana de ese día. */}
                          <button
                            type="button"
                            className="centro-cal-dia-numero"
                            onClick={() => {
                              setAncla(f);
                              setVista('semana');
                            }}
                            title="Ver la semana"
                          >
                            {diaNumero(f)}
                          </button>
                          {todas.length > 0 && (
                            <ul className="centro-cal-dia-horas">
                              {todas.map((h) => {
                                const v = valorDe(f, h);
                                return (
                                  <li key={h} className={v ? undefined : 'libre'}>
                                    <span>{h}</span>
                                    <input
                                      className="centro-cal-paciente chica"
                                      list="centro-pacientes"
                                      placeholder="Libre"
                                      value={v}
                                      aria-label={`Paciente de las ${h}:00 del ${f}`}
                                      onChange={(e) => escribir(f, h, e.target.value)}
                                      onBlur={() => guardar(f, h)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      }}
                                      disabled={guardando === clave(f, h)}
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
