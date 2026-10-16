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
import { useEffect, useState } from 'react';
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

type Reserva = {
  id: string;
  fecha: string;
  desde: string;
  hasta: string;
  sala: string;
  /** Hora fija de un mes que viene, proyectada del contrato: se confirma el 1. */
  prevista?: boolean;
};
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
  /**
   * Lo ya guardado que el servidor todavía no devolvió: entre el guardado y
   * el redibujo pasan unos cientos de milisegundos, y sin esto el campo
   * volvía a mostrar el nombre anterior en el medio (un parpadeo). Se vacía
   * cuando llegan los turnos nuevos.
   */
  const [recien, setRecien] = useState<Record<string, string>>({});
  useEffect(() => {
    setRecien({});
  }, [turnos]);
  const [guardando, setGuardando] = useState<string | null>(null);
  /** El campo que tiene las sugerencias abiertas ("fecha|hora") y cuál está
   *  marcada con el teclado. Es un desplegable propio: el del navegador no se
   *  puede pintar y quedaba fuera de lugar en la pastilla del mes. */
  const [abierto, setAbierto] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(0);

  const clave = (fecha: string, h: number) => `${fecha}|${h}`;
  const guardado = new Map(turnos.map((t) => [clave(t.fecha, t.hora), t]));

  /** La sala de cada hora reservada, por "fecha|hora". */
  const reservada = new Map<string, string>();
  /** Las horas previstas (proyectadas del contrato), por "fecha|hora". */
  const prevista = new Set<string>();
  for (const r of reservas) {
    for (let h = horaDe(r.desde); h < horaDe(r.hasta); h++) {
      reservada.set(clave(r.fecha, h), r.sala);
      if (r.prevista) prevista.add(clave(r.fecha, h));
    }
  }

  function valorDe(fecha: string, h: number): string {
    const k = clave(fecha, h);
    return borrador[k] ?? recien[k] ?? guardado.get(k)?.paciente ?? '';
  }

  function escribir(fecha: string, h: number, paciente: string) {
    setBorrador((prev) => ({ ...prev, [clave(fecha, h)]: paciente }));
    setAbierto(clave(fecha, h));
    setMarcada(0);
  }

  /** Las fichas que coinciden con lo escrito, hasta seis; sin escribir, las
   *  primeras seis. */
  function sugerenciasPara(valor: string): string[] {
    const q = valor.trim().toLowerCase();
    return pacientes.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 6);
  }

  /** Elegir una sugerencia: se escribe y se guarda en el acto. */
  function elegir(fecha: string, h: number, nombre: string) {
    const k = clave(fecha, h);
    setAbierto(null);
    setBorrador((prev) => ({ ...prev, [k]: nombre }));
    // El guardado lee el borrador: se espera al dibujo siguiente.
    setTimeout(() => guardarCon(fecha, h, nombre), 0);
  }

  async function guardar(fecha: string, h: number) {
    const k = clave(fecha, h);
    const b = borrador[k];
    if (b === undefined) return;
    await guardarCon(fecha, h, b);
  }

  async function guardarCon(fecha: string, h: number, b: string) {
    const k = clave(fecha, h);
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
    setRecien((prev) => ({ ...prev, [k]: paciente }));
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
  const hayPrevistas = [...prevista].some((k) => k.startsWith(vista === 'semana' ? semana[0].slice(0, 7) : periodo.slice(0, 7)));

  // ----------------------------------------------------------- una celda
  const fichaDe = (fecha: string, h: number) => {
    const k = clave(fecha, h);
    // Mientras lo recién guardado espera el redibujo, el ícono viejo no vale.
    return borrador[k] === undefined && recien[k] === undefined ? guardado.get(k)?.pacienteId : undefined;
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

  /**
   * Un día como casillero de calendario: el día arriba y debajo sus horas
   * reservadas, cada una con el campo del paciente. Es la misma celda en la
   * semana (cinco casilleros altos, con el ícono de la ficha) y en el mes
   * (la grilla entera, más chica). Lo no reservado no se dibuja: no tiene sala.
   */
  const celdaDia = (f: string, grande: boolean) => {
    const delMes = grande || f.slice(0, 7) === periodo.slice(0, 7);
    // Un turno anotado sobre una hora que ya no está reservada (huérfano)
    // igual se muestra, en rojo, para borrarlo o pasarlo a otra hora.
    const huerfanas = [...guardado.keys()]
      .filter((k) => k.startsWith(f) && !reservada.has(k))
      .map((k) => Number(k.split('|')[1]));
    const reservadas = [...new Set([...reservada.keys()].filter((k) => k.startsWith(f)).map((k) => Number(k.split('|')[1])).concat(huerfanas))]
      .sort((x, y) => x - y);
    // En la semana van todas las horas del día, de 8 a 20, y las que no están
    // reservadas se ven apagadas: así se lee el día entero y no solo lo que
    // hay. En el mes, solo las reservadas, que el casillero es chico.
    const horasDia = grande
      ? [...new Set(Array.from({ length: 13 }, (_, i) => 8 + i).concat(reservadas.filter((h) => h < 8 || h > 20)))].sort((x, y) => x - y)
      : reservadas;
    return (
      <td
        key={f}
        className={`centro-cal-dia${delMes ? '' : ' otro-mes'}${f === hoy ? ' hoy' : ''}${f < hoy ? ' pasado' : ''}${abierto?.startsWith(f) ? ' abierta' : ''}`}
      >
        {grande ? (
          <div className="centro-cal-dia-numero fijo">
            {DIAS_LARGOS[diaSemanaDe(f)]} {diaNumero(f)}
            {f === hoy && <span className="centro-agenda-hoy">Hoy</span>}
          </div>
        ) : (
          /* El número abre la semana de ese día. */
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
            {f === hoy && <span className="centro-agenda-hoy">Hoy</span>}
          </button>
        )}
        {horasDia.length === 0 ? null : (
          <ul className={`centro-cal-dia-horas${grande ? ' grande' : ''}`}>
            {horasDia.map((h) => {
              const v = valorDe(f, h);
              const k = clave(f, h);
              const fichaId = fichaDe(f, h);
              if (!reservada.has(k) && !guardado.has(k)) {
                return (
                  <li key={h} className="sin-reserva" title="Sin reserva">
                    <span>{String(h).padStart(2, '0')}</span>
                    <i />
                  </li>
                );
              }
              return (
                <li
                  key={h}
                  className={`${v ? '' : 'libre'}${prevista.has(k) ? ' prevista' : ''}${!reservada.has(k) ? ' huerfano' : ''}${abierto === k ? ' abierta' : ''}`.trim() || undefined}
                  title={
                    !reservada.has(k)
                      ? 'Esta hora ya no está reservada: borrá el nombre o anotalo en otra hora'
                      : prevista.has(k)
                        ? `${reservada.get(k)} · hora fija prevista, se confirma el 1`
                        : undefined
                  }
                >
                  <span title={reservada.get(k)}>{String(h).padStart(2, '0')}</span>
                  {(fichaId ? (
                      <Link href={`/centro/pacientes/${fichaId}`} className="centro-cal-ficha-chica" title="Abrir la ficha">
                        {dibujoFicha}
                      </Link>
                    ) : (
                      <span className="centro-cal-ficha-chica vacia" />
                    ))}
                  <input
                    className="centro-cal-paciente chica"
                    autoComplete="off"
                    placeholder="Libre"
                    value={v}
                    title={reservada.get(k)}
                    aria-label={`Paciente de las ${h}:00 del ${f}`}
                    onChange={(e) => escribir(f, h, e.target.value)}
                    onFocus={() => {
                      setAbierto(k);
                      setMarcada(0);
                    }}
                    onBlur={() => {
                      setAbierto(null);
                      guardar(f, h);
                    }}
                    onKeyDown={(e) => {
                      const lista = abierto === k ? sugerenciasPara(v).filter((n) => n !== v.trim()) : [];
                      if (e.key === 'ArrowDown' && lista.length) {
                        e.preventDefault();
                        setMarcada((m) => (m + 1) % lista.length);
                      } else if (e.key === 'ArrowUp' && lista.length) {
                        e.preventDefault();
                        setMarcada((m) => (m - 1 + lista.length) % lista.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (lista.length && v.trim() && lista[marcada] !== v) elegir(f, h, lista[marcada]);
                        else (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setAbierto(null);
                      }
                    }}
                    disabled={guardando === k}
                  />
                  {abierto === k && (v.trim() !== '' || sugerenciasPara(v).length > 0) && (
                    <ul className="centro-sugerencias" role="listbox">
                      {/* Primero el que está anotado, con la cruz para sacarlo:
                          un turno se borra desde acá y no vaciando el campo. */}
                      {v.trim() !== '' && (
                        <li className="actual" onMouseDown={(e) => e.preventDefault()}>
                          <span>{v.trim()}</span>
                          <button
                            type="button"
                            className="centro-sug-quitar"
                            title="Borrar el turno"
                            aria-label="Borrar el turno"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAbierto(null);
                              setBorrador((prev) => ({ ...prev, [k]: '' }));
                              setTimeout(() => guardarCon(f, h, ''), 0);
                            }}
                          >
                            ×
                          </button>
                        </li>
                      )}
                      {sugerenciasPara(v).filter((n) => n !== v.trim()).map((n, i) => (
                        <li
                          key={n}
                          role="option"
                          aria-selected={i === marcada}
                          className={i === marcada ? 'marcada' : undefined}
                          // mousedown y no click: el click llega después del
                          // blur, que ya cerró la lista.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            elegir(f, h, n);
                          }}
                          onMouseEnter={() => setMarcada(i)}
                        >
                          {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </td>
    );
  };

  return (
    <main className="centro-cuerpo centro-cuerpo-ancho centro-cuerpo-calendario">
      <h1 className="centro-titulo">Turnos</h1>
      {error && <p className="centro-error">{error}</p>}

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

        {hayPrevistas && (
          <p className="centro-nota centro-cal-aviso">
            Las horas rayadas son tus horas fijas del mes que viene, previstas por tu contrato: podés
            anotar turnos ahí. Se confirman el 1, cuando se generan las reservas.
          </p>
        )}

        <div className="centro-cal-marco">
          {vista === 'semana' ? (
            <table className="centro-cal-mes centro-cal-mes-semana">
              <tbody>
                <tr>{semana.map((f) => celdaDia(f, true))}</tr>
              </tbody>
            </table>
          ) : (
            <table
              className="centro-cal-mes"
              style={
                {
                  // Todos los días del mismo alto: el del día con más horas.
                  '--cal-filas': Math.max(
                    3,
                    ...semanasDelMes.flat().map((f) => [...reservada.keys()].filter((k) => k.startsWith(f)).length)
                  ),
                } as React.CSSProperties
              }
            >
              <thead>
                <tr>
                  {semanasDelMes[0].map((f) => (
                    <th key={f}>{DIAS_CORTOS[diaSemanaDe(f)]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanasDelMes.map((dias) => (
                  <tr key={dias[0]}>{dias.map((f) => celdaDia(f, false))}</tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
