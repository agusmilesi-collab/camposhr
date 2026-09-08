'use client';

/**
 * Las semanas que vienen, sus huecos y la reserva.
 *
 * **Una sala y el mes entero, no un día y todas las salas.** Hasta el 8/9/2026
 * arriba había una tira de días que se corría con el pulgar y debajo la grilla
 * de ese día: para encontrar un hueco el jueves 24 había que tocar día por día
 * hasta llegar, y comparar dos fechas era imposible porque nunca estaban las
 * dos en pantalla. Ahora la sala se elige una vez y los días van en filas, así
 * el mes se lee de arriba abajo y los huecos se ven todos juntos.
 *
 * Sigue pensada para el teléfono: trece columnas de hora entran en una mano,
 * treinta y cinco días de scroll vertical son el gesto natural.
 *
 * **El precio se muestra antes de confirmar**, con la misma cuenta que hace el
 * servidor. Reservar sin saber cuánto sale es lo que hoy obliga a preguntar por
 * WhatsApp.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Burbuja from './Burbuja';
import {
  cotizar,
  diaSemanaDe,
  DIAS_CORTOS,
  DIAS_DE_LA_SEMANA,
  DIAS_PARA_SOLTAR,
  HORAS_LIBERABLES,
  MINUTOS_PARA_DESHACER,
  grillaDeUnaSala,
  hora,
  horasSemanalesTotales,
  sumarDias,
  type Apertura,
  type Cierre,
  type Contrato,
  type Espacio,
  type Reserva,
  type Tarifa,
} from '@/lib/consultorios-calculo';

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function corta(iso: string) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  return {
    dia: new Intl.DateTimeFormat('es-AR', { day: 'numeric' }).format(d),
    nombre: new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(d).replace('.', ''),
    mes: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(d).replace('.', ''),
    /** El mes en número: "8/9" entra en un renglón donde "8 sep" no. */
    mesN: Number(iso.slice(5, 7)),
  };
}

function larga(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

export default function Reservar({
  espacios,
  aperturas,
  cierres,
  reservas,
  contratos,
  tarifas,
  miId,
  hoy,
  puedeReservar,
}: {
  espacios: Espacio[];
  aperturas: Apertura[];
  cierres: Cierre[];
  reservas: Reserva[];
  contratos: Contrato[];
  tarifas: Tarifa[];
  miId: string;
  hoy: string;
  puedeReservar: boolean;
}) {
  const router = useRouter();

  // Los días del próximo mes en que el Centro abre: el domingo no se ofrece,
  // porque ofrecerlo para tocarlo es ofrecer un error.
  const dias: string[] = [];
  for (let i = 0; i < 35 && dias.length < 28; i++) {
    const d = sumarDias(hoy, i);
    if (diaSemanaDe(d) < DIAS_DE_LA_SEMANA) dias.push(d);
  }

  /**
   * Los días en semanas, cada una en su lugar de la fila.
   *
   * Una semana es un arreglo de seis posiciones (lunes a sábado) con el día
   * que le toca o nada: la ventana arranca hoy, que puede ser un miércoles, y
   * sin los huecos del principio las columnas de la primera semana caerían
   * bajo el nombre del día equivocado.
   */
  const semanas: (string | null)[][] = [];
  for (const d of dias) {
    const col = diaSemanaDe(d);
    if (semanas.length === 0 || col <= semanas[semanas.length - 1].findLastIndex((x) => x !== null))
      semanas.push(Array<string | null>(DIAS_DE_LA_SEMANA).fill(null));
    semanas[semanas.length - 1][col] = d;
  }

  /**
   * Qué sala se mira: una, o **todas** juntas.
   *
   * "Todas" empieza siendo la vista, porque la pregunta de quien busca un hueco
   * casi nunca es "¿está libre el 2?": es "¿tenés algo el jueves a las tres?".
   * Ahí cada día se parte en sus salas, como en el calendario de las
   * psicólogas, y se ve de un golpe dónde queda lugar.
   */
  const [salaId, setSalaId] = useState('todas');
  const [elegida, setElegida] = useState<{ fecha: string; desde: number; salaId: string } | null>(
    null
  );
  const [hasta, setHasta] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const todas = salaId === 'todas';
  const mirando = todas ? espacios : espacios.filter((e) => e.id === salaId);

  /** La grilla de cada sala. En "todas" se cruzan para saber cuántas hay libres. */
  const grillas = mirando.map((e) => ({
    espacio: e,
    ...grillaDeUnaSala(e, dias, aperturas, cierres, reservas, miId),
  }));
  const horas = [...new Set(grillas.flatMap((g) => g.horas))].sort((a, b) => a - b);

  const espacio = espacios.find((e) => e.id === elegida?.salaId) ?? null;
  const cantidad = elegida ? hasta - elegida.desde : 0;

  const cotizacion =
    elegida && espacio
      ? cotizar(
          tarifas,
          espacio.id,
          Math.max(horasSemanalesTotales(contratos, miId, elegida.fecha), cantidad)
        )
      : null;
  const importe = cotizacion ? cotizacion.precioHora * cantidad : null;

  /**
   * El arrastre para elegir varias horas, como en un calendario.
   *
   * Solo con mouse: en el teléfono, capturar el arrastre sobre la grilla mata
   * el desplazamiento de la página, y esta pantalla se usa sobre todo desde el
   * teléfono. Ahí sigue el toque más el selector de hasta cuándo.
   */
  const [arrastrando, setArrastrando] = useState(false);
  /** Desde dónde se arrastra, en una referencia: el estado se actualiza recién
   *  en el dibujo siguiente y el primer tramo del gesto se perdía. */
  const desdeRef = useRef<{ fecha: string; desde: number; salaId: string } | null>(null);
  /** La celda de la que cuelga la burbuja. Se mide en cada cuadro, porque la
   *  selección crece mientras se arrastra. */
  const anclaRef = useRef<HTMLElement | null>(null);
  /** La reserva propia que se tocó en la grilla, para poder soltarla ahí mismo. */
  const [mia, setMia] = useState<string | null>(null);

  useEffect(() => {
    if (!arrastrando) return;
    const soltar = () => setArrastrando(false);
    window.addEventListener('pointerup', soltar);
    return () => window.removeEventListener('pointerup', soltar);
  }, [arrastrando]);

  /** Si esa hora está libre en la sala que se está por reservar. */
  function libreEn(salaId: string, fecha: string, h: number): boolean {
    const g = grillas.find((x) => x.espacio.id === salaId);
    return g?.celdas[`${fecha}|${h}`]?.estado === 'libre';
  }

  function estirar(fecha: string, h: number) {
    const desde = desdeRef.current;
    if (!desde || desde.fecha !== fecha) return;
    const libre = (a: number, b: number) => {
      for (let x = a; x < b; x++) if (!libreEn(desde.salaId, fecha, x)) return false;
      return true;
    };
    if (h >= desde.desde) {
      if (libre(desde.desde, h + 1) && hasta !== h + 1) {
        setElegida(desde);
        setHasta(h + 1);
      }
      return;
    }
    if (libre(h, desde.desde + 1) && elegida?.desde !== h) {
      setElegida({ ...desde, desde: h });
      setHasta(desde.desde + 1);
    }
  }

  /** Hasta dónde se puede estirar sin pisar algo tomado ni cerrado. */
  function tope(salaId: string, fecha: string, desde: number): number {
    let h = desde + 1;
    while (h <= horas[horas.length - 1]) {
      if (!libreEn(salaId, fecha, h)) break;
      h++;
    }
    return h;
  }

  async function confirmar() {
    if (!elegida) return;
    setEnviando(true);
    setError(null);
    const res = await fetch('/api/centro/reservar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        espacioId: elegida.salaId,
        fecha: elegida.fecha,
        desdeHora: `${String(elegida.desde).padStart(2, '0')}:00`,
        hastaHora: `${String(hasta).padStart(2, '0')}:00`,
      }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setEnviando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo reservar.');
    setElegida(null);
    setOk('Listo, la hora quedó reservada.');
    router.refresh();
  }

  /**
   * Qué se puede hacer con una reserva propia y por qué.
   *
   * La misma cuenta que hace el servidor, para que la pantalla no ofrezca un
   * botón que va a ser rechazado ni esconda uno que iba a andar.
   */
  function comoSoltar(r: Reserva) {
    const horas = hora(r.hasta_hora) - hora(r.desde_hora);
    const reciente =
      r.created_at !== undefined &&
      (Date.now() - new Date(r.created_at).getTime()) / 60000 <= MINUTOS_PARA_DESHACER;
    const aTiempo = r.fecha >= sumarDias(hoy, DIAS_PARA_SOLTAR);
    const porQueNo = reciente
      ? null
      : !aTiempo
        ? `Se suelta hasta ${DIAS_PARA_SOLTAR} días antes`
        : horas > HORAS_LIBERABLES
          ? `Son ${horas} horas y el tope es ${HORAS_LIBERABLES} por mes`
          : null;
    return { horas, reciente, porQueNo };
  }

  async function soltar(id: string) {
    setError(null);
    setOk(null);
    const res = await fetch('/api/centro/liberar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    if (!r.ok) return setError(r.motivo ?? 'No se pudo soltar.');
    // Deshacer y soltar terminan distinto y hay que decirlo: en un caso la
    // reserva se borra como si no hubiera existido y en el otro queda un
    // crédito, que es plata que aparece en la cuenta del mes que viene.
    setOk(
      r.deshecha
        ? 'Listo, la reserva se canceló y no queda ningún cargo.'
        : 'La hora quedó libre y el crédito descuenta del mes que viene.'
    );
    router.refresh();
  }

  return (
    <>
      {/* Todas juntas o una sola. "Todas" contesta "¿tenés algo el jueves a
          las tres?", que es la pregunta que se hace más seguido; el número de
          la celda dice cuántas salas quedan libres a esa hora. */}
      <div className="centro-salas">
        <button
          type="button"
          className={`centro-sala${todas ? ' activo' : ''}`}
          onClick={() => {
            setSalaId('todas');
            setElegida(null);
            setOk(null);
            setError(null);
          }}
        >
          Todas
        </button>
        {espacios.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`centro-sala${e.id === salaId ? ' activo' : ''}`}
            onClick={() => {
              setSalaId(e.id);
              setElegida(null);
              setOk(null);
              setError(null);
            }}
          >
            {e.tipo === 'sum' ? 'SUM' : e.nombre.replace('Consultorio ', 'Cons. ')}
          </button>
        ))}
      </div>

      {error && <p className="centro-error">{error}</p>}
      {ok && <p className="centro-nota">{ok}</p>}

      {elegida && espacio && (
        <Burbuja ancla={() => anclaRef.current?.getBoundingClientRect() ?? null} cerrar={() => setElegida(null)}>
          <div className="centro-burbuja-top">
            <strong>{espacio.nombre}</strong>
            <button
              type="button"
              className="centro-burbuja-cerrar"
              onClick={() => setElegida(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="centro-burbuja-cuando">{larga(elegida.fecha)}</div>
          <div className="centro-fila">
            <span>De {String(elegida.desde).padStart(2, '0')}:00 a</span>
            <select
              className="centro-campo"
              value={hasta}
              onChange={(e) => setHasta(Number(e.target.value))}
            >
              {Array.from(
                { length: tope(elegida.salaId, elegida.fecha, elegida.desde) - elegida.desde },
                (_, i) => elegida.desde + i + 1
              ).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          {importe !== null && cotizacion && (
            <p className="centro-nota">
              {cantidad} {cantidad === 1 ? 'hora' : 'horas'} · {pesos(cotizacion.precioHora)} la hora ·{' '}
              <strong>{pesos(importe)}</strong>
              {espacio.incluye.length > 0 && ` · ${espacio.incluye.map((i) => i.texto).join(', ')}`}
            </p>
          )}
          {importe === null && (
            <p className="centro-nota">
              Esta sala todavía no tiene precio cargado. Consultá antes de confirmar.
            </p>
          )}
          <button
            className="centro-boton centro-burbuja-boton"
            type="button"
            onClick={confirmar}
            disabled={enviando || !puedeReservar}
          >
            {enviando ? 'Reservando…' : 'Reservar'}
          </button>
        </Burbuja>
      )}

      {/* La reserva propia, en su burbuja: qué es, cuánto salió y el botón que
          corresponde según cuándo se hizo y para cuándo es. */}
      {mia &&
        (() => {
          const r = reservas.find((x) => x.id === mia);
          if (!r) return null;
          const e = espacios.find((x) => x.id === r.espacio_id);
          const c = comoSoltar(r);
          return (
            <Burbuja
              ancla={() => anclaRef.current?.getBoundingClientRect() ?? null}
              cerrar={() => setMia(null)}
            >
              <div className="centro-burbuja-top">
                <strong>{e?.nombre ?? 'Sala'}</strong>
                <button
                  type="button"
                  className="centro-burbuja-cerrar"
                  onClick={() => setMia(null)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <div className="centro-burbuja-cuando">{larga(r.fecha)}</div>
              <p className="centro-nota">
                {r.desde_hora.slice(0, 5)} a {r.hasta_hora.slice(0, 5)} · {c.horas}{' '}
                {c.horas === 1 ? 'hora' : 'horas'}
                {r.importe !== null ? ` · ${pesos(Number(r.importe))}` : ''}
              </p>
              {/* La regla en letra chica y el botón al final: primero se lee
                  qué pasa si se aprieta y después se aprieta, que es el orden
                  en que se decide. */}
              <p className="centro-regla">
                Una reserva recién hecha se cancela sin cargo durante{' '}
                {MINUTOS_PARA_DESHACER} minutos. Pasados los {MINUTOS_PARA_DESHACER} minutos, una
                hora se puede liberar hasta {DIAS_PARA_SOLTAR} días antes y hasta un máximo de{' '}
                {HORAS_LIBERABLES} horas por mes, y el crédito descuenta del mes siguiente. Pasado
                ese plazo, la hora se paga.
              </p>
              {c.porQueNo ? (
                <p className="centro-nota">{c.porQueNo}.</p>
              ) : (
                <button
                  className="centro-boton centro-burbuja-boton"
                  type="button"
                  onClick={() => {
                    setMia(null);
                    soltar(r.id);
                  }}
                >
                  {c.reciente ? 'Cancelar la reserva' : 'Soltar la hora'}
                </button>
              )}
            </Burbuja>
          );
        })()}

      <div className="centro-panel">
        {/* Con una sala elegida, su nombre encabeza el panel; con todas, el
            rótulo va en la esquina de la tabla, sobre la fila que nombra los
            consultorios, que es donde se busca qué significa ese "1 2 3". */}
        {!todas && <h2>{mirando[0]?.nombre ?? 'Sala'}</h2>}
        {horas.length === 0 ? (
          <p className="centro-nota">Este consultorio no está abierto.</p>
        ) : (
          /* Una tabla por semana, y adentro cada día partido en sus salas,
             como el calendario de las psicólogas. Con las cuatro salas a la
             vista se ve de un golpe dónde hay lugar sin tener que entrar sala
             por sala; con una elegida, la semana queda en seis columnas y
             entra en un teléfono. */
          <div className="centro-semanas">
            {semanas.map((semana, k) => (
              <div className="centro-marco" key={k}>
                <table className={`centro-mes${todas ? ' centro-mes-salas' : ''}`}>
                  <thead>
                    <tr>
                      <th className="centro-hora" />
                      {semana.map((d, col) => (
                        <th key={col} colSpan={mirando.length} className="centro-dia-cab">
                          {d ? `${DIAS_CORTOS[col]} ${corta(d).dia}/${corta(d).mesN}` : DIAS_CORTOS[col]}
                        </th>
                      ))}
                    </tr>
                    {/* La fila de salas solo cuando hay más de una: con la
                        vista de un consultorio sería la misma palabra repetida
                        seis veces. */}
                    {todas && (
                      <tr className="centro-salas-cab">
                        <th className="centro-hora">Consultorio</th>
                        {semana.map((_, col) =>
                          mirando.map((e) => (
                            <th key={`${col}|${e.id}`} title={e.nombre}>
                              {e.tipo === 'sum' ? 'SUM' : e.nombre.replace('Consultorio ', '')}
                            </th>
                          ))
                        )}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {horas.map((h) => (
                      <tr key={h}>
                        <th className="centro-hora">{String(h).padStart(2, '0')}:00</th>
                        {semana.map((d, col) =>
                          mirando.map((e) => {
                            if (!d)
                              return <td key={`${col}|${e.id}`} className="centro-celda centro-fuera" />;
                            const g = grillas.find((x) => x.espacio.id === e.id);
                            const celda = g?.celdas[`${d}|${h}`];
                            const estado = celda?.estado ?? 'cerrada';
                            const elegidaAca =
                              elegida?.fecha === d &&
                              elegida.salaId === e.id &&
                              h >= elegida.desde &&
                              h < hasta;
                            return (
                              <td
                                key={`${col}|${e.id}`}
                                className={`centro-celda centro-${estado}${
                                  elegidaAca ? ' centro-elegida' : ''
                                }${e.id === mirando[0].id ? ' centro-corte' : ''}`}
                                title={`${e.nombre} · ${larga(d)} · ${String(h).padStart(2, '0')}:00${
                                  estado === 'tomada'
                                    ? ' · ocupada'
                                    : estado === 'cerrada'
                                      ? ' · cerrada'
                                      : estado === 'mia'
                                        ? ' · tuya'
                                        : ' · libre'
                                }`}
                                onPointerDown={(ev) => {
                                  // Lo propio se abre para soltarlo, donde
                                  // está: buscarlo en una lista aparte obliga a
                                  // reconocer la fecha en dos lugares.
                                  if (estado === 'mia' && celda?.reservaId) {
                                    ev.preventDefault();
                                    anclaRef.current = ev.currentTarget;
                                    setElegida(null);
                                    setOk(null);
                                    setError(null);
                                    setMia(celda.reservaId);
                                    return;
                                  }
                                  if (estado !== 'libre' || !puedeReservar) return;
                                  ev.preventDefault();
                                  anclaRef.current = ev.currentTarget;
                                  desdeRef.current = { fecha: d, desde: h, salaId: e.id };
                                  setElegida({ fecha: d, desde: h, salaId: e.id });
                                  setHasta(h + 1);
                                  setOk(null);
                                  setError(null);
                                  // El dedo no arrastra: en el teléfono
                                  // capturar el gesto sobre la grilla mata el
                                  // desplazamiento de la página.
                                  if (ev.pointerType !== 'touch') setArrastrando(true);
                                }}
                                onPointerOver={() => {
                                  if (arrastrando && elegida?.salaId === e.id) estirar(d, h);
                                }}
                              />
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
                {/* Dos estados y no tres: para quien busca un hueco, tomada por otro
            y cerrada por mantenimiento son lo mismo. Cuál de las dos es lo dice
            el rótulo de la celda al pasar por encima. */}
        <div className="centro-referencias">
          <span className="centro-referencia">
            <span className="centro-color mia" /> Tuya
          </span>
          <span className="centro-referencia">
            <span className="centro-color tomada" /> Ocupada
          </span>
          <span className="centro-referencia">Lo blanco está libre.</span>
        </div>
      </div>

    </>
  );
}
