'use client';

/**
 * El calendario del Centro: la semana hora por hora y el mes de un vistazo.
 *
 * **Todo lo que se hace con una hora se hace acá.** Reservarla a nombre de
 * alguien, cerrarla porque la usa el Centro, liberar lo reservado y reabrir lo
 * cerrado. Los cierres tuvieron su propia pestaña hasta el 8/9/2026: cargar un
 * feriado en un formulario aparte obligaba a acordarse de la fecha en vez de
 * verla, y a volver al calendario para comprobar qué se cerró.
 *
 * **Se aprieta en la hora de inicio y se estira hasta la de fin**, como en un
 * calendario. Con el dedo no se arrastra: capturar el gesto sobre la grilla
 * mata el desplazamiento de la página, así que ahí el toque abre la burbuja y
 * la hora de fin se elige en el selector.
 *
 * **La semana muestra las cuatro salas juntas.** La pregunta que se contesta
 * casi nunca es cómo viene una sala: es qué hay libre el jueves a las 17.
 *
 * El precio se muestra antes de guardar, con la misma cuenta que hace el
 * servidor: sale de `lib/consultorios-calculo.ts`, que no toca la base y por eso
 * corre de los dos lados.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  armarGrilla,
  corto,
  cotizar,
  diaSemanaDe,
  DIAS_CORTOS,
  fechasRepetidas,
  finDeMes,
  hora,
  horasSemanalesTotales,
  porSemanas,
  tonosPorInquilino,
  type Apertura,
  type Cierre,
  type Contrato,
  type Espacio,
  type Inquilino,
  type Reserva,
  type Tarifa,
} from '@/lib/consultorios-calculo';
import Burbuja from './Burbuja';
import { mandar, pesos } from './acciones';

type Elegida = { espacioId: string; fecha: string; desde: number };
type Abierta =
  | { que: 'nueva' }
  | { que: 'reserva'; id: string }
  | { que: 'cierre'; id: string; motivo: string; espacioId: string; fecha: string; hora: number };

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

/** "10/9", para nombrar fechas dentro de una frase. */
function diaCorto(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

function diaLargo(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

/** "Consultorio 1" -> "1"; el SUM se llama SUM. */
function sigla(e: Espacio): string {
  return e.tipo === 'sum' ? 'SUM' : e.nombre.replace('Consultorio ', '');
}

export default function Calendario({
  espacios,
  aperturas,
  cierres,
  reservas,
  inquilinos,
  tarifas,
  contratos,
  vista,
  ancla,
  hoy,
}: {
  espacios: Espacio[];
  aperturas: Apertura[];
  cierres: Cierre[];
  reservas: Reserva[];
  inquilinos: Inquilino[];
  tarifas: Tarifa[];
  contratos: Contrato[];
  vista: 'semana' | 'mes';
  /** El lunes de la semana, o los días hábiles del mes. */
  ancla: string[];
  hoy: string;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<Abierta | null>(null);
  const [elegida, setElegida] = useState<Elegida | null>(null);
  const [hasta, setHasta] = useState(0);
  const [modo, setModo] = useState<'reserva' | 'bloqueo'>('reserva');
  const [quien, setQuien] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [motivo, setMotivo] = useState('');
  /** Si la reserva se repite, con qué paso y hasta cuándo. Lo que hoy se carga
   *  a mano semana por semana: "los martes de 17 a 20, todo el mes". */
  const [repetir, setRepetir] = useState<'no' | 'semana' | 'dia'>('no');
  const [repetirHasta, setRepetirHasta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  /** Al liberar, si la hora se devuelve como crédito del mes siguiente. Arranca
   *  en sí, que es lo que corresponde cuando se avisó con tiempo. */
  const [conCredito, setConCredito] = useState(true);

  /**
   * Desde dónde se está arrastrando, en una referencia y no en el estado.
   *
   * El estado se actualiza recién en el dibujo siguiente, y el puntero puede
   * entrar en la celda de al lado antes de eso: leyéndolo del estado, el primer
   * tramo del arrastre se perdía y la selección quedaba de una hora.
   */
  const desdeRef = useRef<Elegida | null>(null);
  /** La caja de lo que se tocó, para que la burbuja sepa dónde pararse. */
  const anclaRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!arrastrando) return;
    const soltar = () => setArrastrando(false);
    window.addEventListener('pointerup', soltar);
    return () => window.removeEventListener('pointerup', soltar);
  }, [arrastrando]);

  // La grilla se arma una sola vez con todos los días del rango, y la vista
  // decide en cuántos pedazos se dibuja: una tabla en la semana, una por semana
  // en el mes. Las claves llevan la fecha, así que el mismo mapa sirve para las
  // dos.
  const grilla = armarGrilla(espacios, ancla, aperturas, cierres, reservas);
  // El color de cada persona. Se arma una vez para toda la grilla: por celda
  // sería recorrer la lista de inquilinos ochocientas veces.
  const tonos = tonosPorInquilino(inquilinos);
  const semanas = vista === 'mes' ? porSemanas(ancla) : [ancla];

  /**
   * Cuánto se vendió de una semana, sobre lo que el Centro abrió.
   *
   * Va al lado del rótulo de cada semana del mes: apiladas, cinco grillas se
   * parecen todas, y el número es lo que dice de un vistazo cuál viene floja.
   */
  function ocupacionDe(dias: string[]): number {
    const abiertas = dias.reduce(
      (n, f) =>
        n +
        aperturas
          .filter((a) => a.dia_semana === diaSemanaDe(f) && espacios.some((e) => e.id === a.espacio_id))
          .reduce((m, a) => m + (hora(a.hasta_hora) - hora(a.desde_hora)), 0),
      0
    );
    // Las horas vendidas se recortan a las mismas salas que las abiertas: en la
    // vista de una sola, `reservas` sigue trayendo las de las cinco (la lectura
    // es por fecha, no por sala) y el porcentaje salía con el numerador de todo
    // el Centro sobre el denominador de un consultorio.
    const vendidas = reservas
      .filter((r) => dias.includes(r.fecha) && espacios.some((e) => e.id === r.espacio_id))
      .reduce((n, r) => n + (hora(r.hasta_hora) - hora(r.desde_hora)), 0);
    return abiertas > 0 ? Math.round((vendidas / abiertas) * 100) : 0;
  }

  function cerrar() {
    setAbierta(null);
    setElegida(null);
    setError(null);
    anclaRef.current = null;
  }

  function abrirNueva(el: HTMLElement, espacioId: string, fecha: string, h: number) {
    anclaRef.current = el;
    desdeRef.current = { espacioId, fecha, desde: h };
    setElegida({ espacioId, fecha, desde: h });
    setHasta(h + 1);
    setModo('reserva');
    setQuien('');
    setNuevoNombre('');
    setNuevoTelefono('');
    setMotivo('');
    setError(null);
    setConCredito(true);
    setRepetir('no');
    setRepetirHasta(finDeMes(fecha));
    setAbierta({ que: 'nueva' });
  }

  /** Estira la selección hasta `h`, hacia abajo o hacia arriba, mientras todo
   *  lo que queda en el medio esté libre. */
  function estirar(espacioId: string, fecha: string, h: number) {
    const desde = desdeRef.current;
    if (!desde || desde.espacioId !== espacioId || desde.fecha !== fecha) return;
    const libre = (a: number, b: number) => {
      for (let x = a; x < b; x++) {
        if (grilla.celdas[`${espacioId}|${fecha}|${x}`]?.estado !== 'libre') return false;
      }
      return true;
    };
    // La hora donde se apretó manda: hacia abajo crece el fin, hacia arriba se
    // mueve el inicio, como en cualquier calendario.
    if (h >= desde.desde) {
      // Se redibuja solo cuando el rango cambia: `pointerover` llega varias
      // veces sobre la misma celda.
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

  /** Hasta dónde se puede estirar sin pisar algo ocupado ni cerrado. */
  function topeDe(e: Elegida): number {
    let h = e.desde + 1;
    const ultima = grilla.horas[grilla.horas.length - 1];
    while (h <= ultima) {
      if (grilla.celdas[`${e.espacioId}|${e.fecha}|${h}`]?.estado !== 'libre') break;
      h++;
    }
    return h;
  }

  const espacio = espacios.find((e) => e.id === elegida?.espacioId) ?? null;
  const cantidad = elegida ? hasta - elegida.desde : 0;
  const fechas = elegida ? fechasRepetidas(elegida.fecha, repetirHasta, repetir) : [];
  const cotizacion =
    elegida && espacio && quien && quien !== 'nueva'
      ? cotizar(
          tarifas,
          espacio.id,
          Math.max(horasSemanalesTotales(contratos, quien, elegida.fecha), cantidad)
        )
      : null;
  const importe = cotizacion ? cotizacion.precioHora * cantidad : null;
  const total = importe === null ? null : importe * fechas.length;

  /** La reserva abierta, con su sala y su gente, para la burbuja. */
  const reservaAbierta =
    abierta?.que === 'reserva' ? reservas.find((r) => r.id === abierta.id) ?? null : null;
  const salaDeLaReserva = espacios.find((e) => e.id === reservaAbierta?.espacio_id) ?? null;

  async function guardar() {
    if (!elegida) return;
    setGuardando(true);
    setError(null);
    const desdeHora = `${String(elegida.desde).padStart(2, '0')}:00`;
    const hastaHora = `${String(hasta).padStart(2, '0')}:00`;

    if (modo === 'bloqueo') {
      const r = await mandar({
        accion: 'cierre-alta',
        fechas,
        espacioId: elegida.espacioId,
        desdeHora,
        hastaHora,
        motivo,
      });
      setGuardando(false);
      if (!r.ok) return setError(r.motivo ?? 'No se pudo cerrar.');
      cerrar();
      return router.refresh();
    }

    let inquilinoId = quien;
    if (quien === 'nueva') {
      if (nuevoNombre.trim().length === 0) {
        setGuardando(false);
        return setError('Falta el nombre de la persona.');
      }
      const alta = await mandar({
        accion: 'inquilino-alta',
        nombre: nuevoNombre,
        telefono: nuevoTelefono,
      });
      if (!alta.ok || !alta.id) {
        setGuardando(false);
        return setError(alta.motivo ?? 'No se pudo dar de alta a la persona.');
      }
      inquilinoId = alta.id;
    }

    const r = await mandar({
      accion: 'reserva-alta',
      espacioId: elegida.espacioId,
      inquilinoId,
      fechas,
      desdeHora,
      hastaHora,
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo reservar.');
    // Las fechas que ya estaban ocupadas no cancelan el resto: se guardó lo que
    // entró y hay que decir qué quedó afuera, o la persona cree que reservó el
    // mes entero.
    if (r.chocaron && r.chocaron.length > 0) {
      setError(
        `Se reservaron ${r.creadas}. Ya estaban ocupadas: ${r.chocaron
          .map((f) => diaCorto(f))
          .join(', ')}.`
      );
      return router.refresh();
    }
    cerrar();
    router.refresh();
  }

  async function liberar(id: string, conCredito: boolean) {
    setGuardando(true);
    const r = await mandar({
      accion: 'reserva-baja',
      id,
      credito: conCredito,
      motivo: conCredito ? 'Hora liberada con aviso' : 'Hora liberada sin crédito',
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo liberar.');
    cerrar();
    router.refresh();
  }

  async function reabrir(id: string) {
    setGuardando(true);
    const r = await mandar({ accion: 'cierre-baja', id });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo reabrir.');
    cerrar();
    router.refresh();
  }

  const anclaDe = () => anclaRef.current?.getBoundingClientRect() ?? null;

  return (
    <>
      {abierta && (
        <Burbuja ancla={anclaDe} cerrar={cerrar}>
          {/* --- Una hora libre: reservarla o cerrarla --- */}
          {abierta.que === 'nueva' && elegida && espacio && (
            <>
              <div className="os-burbuja-top">
                <div>
                  <div className="os-burbuja-titulo">{espacio.nombre}</div>
                  <div className="os-burbuja-sub">{diaLargo(elegida.fecha)}</div>
                </div>
                <button type="button" className="os-burbuja-cerrar" onClick={cerrar} aria-label="Cerrar">
                  ×
                </button>
              </div>

              <div className="os-burbuja-fila os-burbuja-fila-campos">
                <span className="os-burbuja-cuando">
                  De {String(elegida.desde).padStart(2, '0')}:00 a
                </span>
                <select
                  className="os-campo os-campo-suave os-campo-corto"
                  value={hasta}
                  onChange={(e) => setHasta(Number(e.target.value))}
                >
                  {Array.from(
                    { length: topeDe(elegida) - elegida.desde },
                    (_, i) => elegida.desde + i + 1
                  ).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <select
                  className="os-campo os-campo-suave os-campo-corto"
                  value={modo}
                  onChange={(e) => setModo(e.target.value as 'reserva' | 'bloqueo')}
                >
                  <option value="reserva">Reservar</option>
                  <option value="bloqueo">Cerrar</option>
                </select>
              </div>

              <div className="os-burbuja-fila os-burbuja-fila-campos">
                {modo === 'reserva' ? (
                  <select className="os-campo os-campo-suave" value={quien} onChange={(e) => setQuien(e.target.value)}>
                    <option value="">A nombre de…</option>
                    {inquilinos
                      .filter((i) => i.activo)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      ))}
                    <option value="nueva">Alguien que no está en la lista…</option>
                  </select>
                ) : (
                  <input
                    className="os-campo os-campo-suave"
                    autoComplete="off"
                    placeholder="Taller de Sentir, feriado, mantenimiento…"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                )}
              </div>

              <div className="os-burbuja-fila os-burbuja-fila-campos">
                <select
                  className="os-campo os-campo-suave"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value as 'no' | 'semana' | 'dia')}
                  aria-label="Repetir"
                >
                  <option value="no">No se repite</option>
                  <option value="semana">Cada semana</option>
                  <option value="dia">Todos los días</option>
                </select>
                {repetir !== 'no' && (
                  <input
                    className="os-campo os-campo-suave"
                    type="date"
                    value={repetirHasta}
                    min={elegida.fecha}
                    onChange={(e) => setRepetirHasta(e.target.value)}
                    aria-label="Repetir hasta"
                  />
                )}
              </div>

              {modo === 'reserva' && quien === 'nueva' && (
                <div className="os-burbuja-fila os-burbuja-fila-campos">
                  <input
                    className="os-campo os-campo-suave"
                    autoComplete="off"
                    placeholder="Nombre y apellido"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                  />
                  <input
                    className="os-campo os-campo-suave"
                    autoComplete="off"
                    placeholder="Teléfono"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                  />
                </div>
              )}

              {modo === 'reserva' && (
                <div className="os-burbuja-fila">
                  {total !== null && cotizacion ? (
                    <>
                      <strong>{pesos(total)}</strong>
                      <div className="os-burbuja-importe">
                        {fechas.length > 1 && `${fechas.length} fechas · `}
                        {cantidad} {cantidad === 1 ? 'hora' : 'horas'} ·{' '}
                        {pesos(cotizacion.precioHora)} la hora, tramo de{' '}
                        {cotizacion.tramoHasta === null
                          ? `${cotizacion.tramo} o más`
                          : `${cotizacion.tramo} a ${cotizacion.tramoHasta}`}
                      </div>
                    </>
                  ) : (
                    <div className="os-burbuja-importe">
                      {quien === 'nueva'
                        ? 'El precio sale del tramo de 1 hora hasta que tenga horas contratadas.'
                        : 'Elegí a nombre de quién va para ver el precio.'}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="os-burbuja-error">{error}</p>}

              <div className="os-burbuja-pie">
                <button
                  className="os-boton os-boton-firme os-burbuja-principal"
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando…'
                    : modo === 'reserva'
                      ? `Reservar ${cantidad * fechas.length} ${
                          cantidad * fechas.length === 1 ? 'hora' : 'horas'
                        }`
                      : fechas.length > 1
                        ? `Cerrar ${fechas.length} fechas`
                        : 'Cerrar la sala'}
                </button>
              </div>
            </>
          )}

          {/* --- Una hora reservada --- */}
          {abierta.que === 'reserva' && reservaAbierta && (
            <>
              <div className="os-burbuja-top">
                <div>
                  <div className="os-burbuja-titulo">
                    {reservaAbierta.inquilinos?.nombre ?? 'Sin nombre'}
                  </div>
                  <div className="os-burbuja-sub">
                    {salaDeLaReserva?.nombre ?? 'Sala'} ·{' '}
                    {reservaAbierta.origen === 'contrato' ? 'Banda fija' : 'Hora suelta'}
                  </div>
                </div>
                <button type="button" className="os-burbuja-cerrar" onClick={cerrar} aria-label="Cerrar">
                  ×
                </button>
              </div>

              <div className="os-burbuja-fila">
                <div className="os-burbuja-cuando">
                  {diaLargo(reservaAbierta.fecha)}, de {reservaAbierta.desde_hora.slice(0, 5)} a{' '}
                  {reservaAbierta.hasta_hora.slice(0, 5)}
                </div>
                <div className="os-burbuja-importe">
                  {hora(reservaAbierta.hasta_hora) - hora(reservaAbierta.desde_hora)} horas
                  {reservaAbierta.importe !== null
                    ? ` · ${pesos(Number(reservaAbierta.importe))}`
                    : ' · sin precio cargado'}
                </div>
              </div>

              {error && <p className="os-burbuja-error">{error}</p>}

              <div className="os-burbuja-pie">
                <label className="os-tilde-fila">
                  <input
                    type="checkbox"
                    checked={conCredito}
                    onChange={(e) => setConCredito(e.target.checked)}
                  />
                  <span>
                    Devolver el importe como crédito del mes que viene
                    <small>
                      {conCredito
                        ? 'Es lo que corresponde cuando avisó con tiempo.'
                        : 'La hora se cobra igual, como dice el acuerdo.'}
                    </small>
                  </span>
                </label>
                <button
                  className="os-boton os-boton-firme os-burbuja-principal"
                  type="button"
                  disabled={guardando}
                  onClick={() => liberar(reservaAbierta.id, conCredito)}
                >
                  {guardando ? 'Liberando…' : 'Liberar la hora'}
                </button>
              </div>
            </>
          )}

          {/* --- Una hora cerrada --- */}
          {abierta.que === 'cierre' && (
            <>
              <div className="os-burbuja-top">
                <div>
                  <div className="os-burbuja-titulo">{abierta.motivo}</div>
                  <div className="os-burbuja-sub">
                    {espacios.find((e) => e.id === abierta.espacioId)?.nombre ?? 'Sala'} ·{' '}
                    {diaLargo(abierta.fecha)}
                  </div>
                </div>
                <button type="button" className="os-burbuja-cerrar" onClick={cerrar} aria-label="Cerrar">
                  ×
                </button>
              </div>

              <div className="os-burbuja-fila">
                <div className="os-burbuja-importe">
                  La sala no se puede reservar en esta franja, ni desde acá ni desde
                  la pantalla del inquilino.
                </div>
              </div>

              {error && <p className="os-burbuja-error">{error}</p>}

              <div className="os-burbuja-pie">
                <button
                  className="os-boton os-boton-firme os-burbuja-principal"
                  type="button"
                  disabled={guardando}
                  onClick={() => reabrir(abierta.id)}
                >
                  {guardando ? 'Abriendo…' : 'Volver a abrir la sala'}
                </button>
              </div>
            </>
          )}
        </Burbuja>
      )}

      {semanas.map((dias) => (
        <div className={`os-semana${vista === 'mes' ? ' os-semana-compacta' : ''}`} key={dias[0]}>
          <div className="os-agenda-marco">
            <table className="os-agenda">
              <thead>
                <tr>
                  {/* La esquina deja de estar vacía: pegadas una debajo de
                      otra, las semanas no tienen dónde poner su rótulo, y este
                      es el único lugar de la grilla que no dice nada. La barra
                      se compara de un vistazo; el número hay que leerlo. */}
                  <th className="os-agenda-hora os-agenda-esquina" rowSpan={2}>
                    <span
                      className="os-semana-anillo"
                      style={{ ['--pct' as string]: ocupacionDe(dias) }}
                      title={`${ocupacionDe(dias)}% de las horas de esta semana están reservadas`}
                    >
                      <span>{ocupacionDe(dias)}%</span>
                    </span>
                  </th>
                  {dias.map((d, i) => (
                    <th key={d} colSpan={espacios.length} className="os-agenda-dia">
                      {DIAS_CORTOS[i]} {dia(d)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dias.map((d) =>
                    espacios.map((e, i) => (
                      <th
                        key={`${d}|${e.id}`}
                        className={`os-agenda-sala${i === 0 ? ' os-agenda-corte' : ''}`}
                        title={e.nombre}
                      >
                        {sigla(e)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {grilla.horas.map((h) => (
                  <tr key={h}>
                    <th className="os-agenda-hora">{String(h).padStart(2, '0')}:00</th>
                    {dias.map((d) =>
                      espacios.map((e, i) => {
                        const celda = grilla.celdas[`${e.id}|${d}|${h}`];
                        const arriba = grilla.celdas[`${e.id}|${d}|${h - 1}`];
                        const sigue =
                          celda?.estado === 'ocupado' &&
                          arriba?.estado === 'ocupado' &&
                          arriba.reservaId === celda.reservaId;
                        const elegidaAca =
                          elegida?.espacioId === e.id &&
                          elegida?.fecha === d &&
                          h >= elegida.desde &&
                          h < hasta;
                        const clases = [
                          'os-agenda-celda',
                          `os-agenda-${celda?.estado ?? 'cerrado'}`,
                          celda?.estado === 'ocupado' && celda.origen === 'suelta'
                            ? 'os-agenda-suelta'
                            : '',
                          sigue ? 'os-agenda-sigue' : '',
                          i === 0 ? 'os-agenda-corte' : '',
                          elegidaAca ? 'os-agenda-elegida' : '',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <td
                            key={`${d}|${e.id}`}
                            className={clases}
                            /* El color de esa persona, como tono: el resto
                               (cuánto se aclara el fondo, cuánto se oscurece la
                               tinta) lo decide la hoja, que es la que sabe si
                               el tema es claro u oscuro. */
                            style={
                              celda?.estado === 'ocupado'
                                ? ({ '--tono': tonos[celda.inquilinoId] ?? 210 } as React.CSSProperties)
                                : undefined
                            }
                            onPointerDown={(ev) => {
                              if (celda?.estado !== 'libre') return;
                              // Sin esto el navegador arranca a seleccionar el
                              // texto de las celdas y el arrastre pinta media
                              // tabla.
                              ev.preventDefault();
                              abrirNueva(ev.currentTarget, e.id, d, h);
                              // El dedo no arrastra: capturar el gesto sobre la
                              // grilla mata el desplazamiento de la página.
                              if (ev.pointerType !== 'touch') setArrastrando(true);
                            }}
                            onPointerOver={() => {
                              if (arrastrando) estirar(e.id, d, h);
                            }}
                            onClick={(ev) => {
                              if (celda?.estado === 'ocupado') {
                                anclaRef.current = ev.currentTarget;
                                setError(null);
                                setElegida(null);
                                setAbierta({ que: 'reserva', id: celda.reservaId });
                              }
                              if (celda?.estado === 'cerrado' && celda.cierreId) {
                                anclaRef.current = ev.currentTarget;
                                setError(null);
                                setElegida(null);
                                setAbierta({
                                  que: 'cierre',
                                  id: celda.cierreId,
                                  motivo: celda.motivo,
                                  espacioId: e.id,
                                  fecha: d,
                                  hora: h,
                                });
                              }
                            }}
                            title={
                              celda?.estado === 'ocupado'
                                ? `${celda.quien} · ${e.nombre} · ${String(h).padStart(2, '0')}:00`
                                : celda?.estado === 'cerrado'
                                  ? celda.motivo
                                  : `Libre · ${e.nombre}`
                            }
                          >
                            {/* El nombre en cada hora del bloque y no solo en
                                la primera: leyendo una fila de la grilla, "las
                                cinco de la tarde", una celda sin nombre obliga
                                a subir con la vista hasta encontrar de quién
                                es. El bloque se sigue leyendo como uno solo
                                porque las horas que continúan no llevan borde
                                arriba. */}
                            {celda?.estado === 'ocupado' && (
                              <span className="os-agenda-quien">{corto(celda.quien)}</span>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="os-referencias">
        <span className="os-referencia">
          <span className="os-referencia-color banda" /> Banda fija
        </span>
        <span className="os-referencia">
          <span className="os-referencia-color hora-suelta" /> Hora suelta
        </span>
        <span className="os-referencia">
          <span className="os-referencia-color cerrado" /> Cerrado
        </span>
      </div>
    </>
  );
}
