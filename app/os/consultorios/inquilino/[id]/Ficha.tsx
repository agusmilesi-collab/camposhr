'use client';

/**
 * La pantalla de una persona que alquila.
 *
 * Cuatro preguntas, en este orden: quién es, qué alquila, cómo viene y qué
 * debe. Antes las tres primeras no estaban en ningún lado y la cuarta era un
 * panel que se abría debajo de la lista de todos.
 *
 * **El resumen del mes se imprime desde acá.** Es lo que se le manda cuando
 * pregunta qué debe, y se arma solo con lo que ya está en la cuenta: las horas
 * del mes, lo que pagó y el saldo. La hoja se dibuja siempre y aparece recién
 * al imprimir, como el informe de psicotécnicos, así lo que sale en el PDF es
 * exactamente lo que se ve en la pantalla y no una segunda versión que se
 * separa en la primera corrección.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DIAS_CORTOS,
  diaSemanaDe,
  hora,
  horasSemanalesTotales,
  mesLargo,
  periodoDe,
  recargoDelDia,
  saldoDe,
  signo,
  type Contrato,
  type Espacio,
  type Inquilino,
  type Movimiento,
  type Reserva,
} from '@/lib/consultorios-calculo';
import { mandar, pesos } from '../../acciones';

const NOMBRE: Record<Movimiento['tipo'], string> = {
  cargo: 'Reserva',
  pago: 'Pago',
  recargo: 'Recargo',
  credito: 'Crédito',
  ajuste: 'Ajuste',
};

/** Solo el mes, para escribir "hasta el 10 de septiembre". */
function soloMes(periodo: string): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(
    new Date(`${periodo}T12:00:00-03:00`)
  );
}

/**
 * El camino de la línea del histórico, curvo.
 *
 * Con segmentos rectos, doce meses dibujan una sierra de picos duros y la
 * atención se va a los vértices en vez de a la tendencia. Es una Catmull-Rom
 * pasada a Bézier: la curva pasa por todos los puntos, y la tensión es baja
 * para que en un pico no se dispare por encima del lienzo.
 */
function curvaSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length < 2) return '';
  const t = 0.16;
  const n = (v: number) => Math.round(v * 100) / 100;
  const d = [`M ${n(puntos[0].x)} ${n(puntos[0].y)}`];
  for (let k = 0; k < puntos.length - 1; k++) {
    const p0 = puntos[k - 1] ?? puntos[k];
    const p1 = puntos[k];
    const p2 = puntos[k + 1];
    const p3 = puntos[k + 2] ?? p2;
    d.push(
      `C ${n(p1.x + (p2.x - p0.x) * t)} ${n(p1.y + (p2.y - p0.y) * t)},` +
        ` ${n(p2.x - (p3.x - p1.x) * t)} ${n(p2.y - (p3.y - p1.y) * t)},` +
        ` ${n(p2.x)} ${n(p2.y)}`
    );
  }
  return d.join(' ');
}

/** Cuántos meses de historia se dibujan. Doce: un año se compara consigo mismo. */
const MESES = 12;

/**
 * Qué dice el renglón de un movimiento.
 *
 * En un cargo, la fecha de la fila es el día en que se usó la sala y no el día
 * en que se cargó, pero eso hay que saberlo: al lado de un pago, que sí lleva
 * la fecha en que se pagó, la misma columna dice dos cosas distintas. El
 * detalle lo escribe entero, con el día de la semana, que es como se piensa una
 * hora de consultorio.
 */
function detalleDe(m: Movimiento): string {
  if (m.tipo !== 'cargo') return m.detalle ?? '—';
  const cuando = `${DIAS_CORTOS[diaSemanaDe(m.fecha)]} ${dia(m.fecha)}`;
  return m.detalle ? `${cuando}, ${m.detalle}` : cuando;
}

function dia(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

/** El mes de al lado, en la forma en que se guarda `periodo`. */
function mesCorrido(periodo: string, n: number): string {
  const d = new Date(`${periodo}T12:00:00-03:00`);
  d.setMonth(d.getMonth() + n);
  return periodoDe(d.toISOString().slice(0, 10));
}

/** "Sep" y no "septiembre": doce rótulos en una fila de gráfico. */
function mesCorto(periodo: string): string {
  const t = new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(
    new Date(`${periodo}T12:00:00-03:00`)
  );
  return t.replace('.', '').replace(/^./, (c) => c.toUpperCase());
}

export default function Ficha({
  inquilino,
  espacios,
  contratos,
  movimientos,
  reservas,
  firma,
  periodo,
  hoy,
}: {
  inquilino: Inquilino;
  espacios: Espacio[];
  contratos: Contrato[];
  movimientos: Movimiento[];
  reservas: Reserva[];
  /** Quién firma los recibos del Centro. Ver el porqué en `page.tsx`. */
  firma: { nombre: string; cargo: string; trazo: string | null } | null;
  periodo: string;
  hoy: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);
  /** Qué movimiento está esperando confirmación para borrarse. */
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [conRecargo, setConRecargo] = useState(true);
  /** Qué hoja se está imprimiendo: el resumen del mes o el recibo de un pago. */
  const [imprimiendo, setImprimiendo] = useState<'cuenta' | 'recibo' | null>(null);
  const [recibo, setRecibo] = useState<Movimiento | null>(null);
  /**
   * Las dos hojas se cuelgan del `body` y no de acá.
   *
   * Al imprimir se esconde todo lo que cuelga del `body` menos la hoja
   * (`body[data-imprimir] > *:not(...)`), y esa regla alcanza a los hijos
   * directos: dentro del árbol de la pantalla, la hoja se iba con el contenedor
   * que la contenía y el PDF salía en blanco. Es lo mismo que hace el diagrama
   * de potencial.
   *
   * El portal se arma después de montar, porque en el servidor no hay `body`.
   */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const i = inquilino;
  const pct = recargoDelDia(hoy, periodo);
  const salaDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';

  const delMes = movimientos.filter((m) => m.periodo === periodo);
  const cargos = delMes.filter((m) => m.tipo === 'cargo').reduce((n, m) => n + m.importe, 0);
  const pagos = delMes.filter((m) => m.tipo === 'pago').reduce((n, m) => n + m.importe, 0);
  const saldo = saldoDe(delMes);
  // Lo que de verdad debe: el mes que se está mirando puede estar al día y
  // arrastrar una deuda de dos meses atrás.
  const total = saldoDe(movimientos);

  const horas = horasSemanalesTotales(contratos, i.id, hoy);
  const vigentes = contratos.filter(
    (c) => c.vigente_desde <= hoy && (c.vigente_hasta === null || c.vigente_hasta >= hoy)
  );

  /**
   * Cada hora del mes, con lo que costó.
   *
   * El resumen listaba los cargos con su importe y nada más: quien lo recibe
   * veía "$ 5.985" y no de dónde salía. Acá cada renglón dice qué día, en qué
   * sala, de qué hora a qué hora, cuántas horas y a cuánto la hora, que es la
   * cuenta que puede rehacer solo.
   *
   * Sala y horario salen de la reserva; si la reserva ya no está (se liberó y
   * el cargo quedó, que es lo que corresponde), se leen del detalle que se
   * guardó con el movimiento.
   */
  const consumos = delMes
    .filter((m) => m.tipo === 'cargo')
    // De la primera hora del mes a la última. En la pantalla la cuenta va al
    // revés, porque ahí se busca lo último que pasó; el resumen se lee como un
    // extracto, del principio del mes al final.
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => {
      const r = reservas.find((x) => x.id === m.reserva_id);
      const desde = r?.desde_hora.slice(0, 5);
      const hasta = r?.hasta_hora.slice(0, 5);
      // La sala y el horario se leen del principio del detalle y no de todo él:
      // a un cargo liberado se le anexa la aclaración, y exigiendo que la
      // cadena termine en la hora ese renglón salía sin sala ni horario.
      const partido = /^(.*?), (\d{2}:\d{2}) a (\d{2}:\d{2})(?: ·.*)?$/.exec(m.detalle ?? '');
      const sala = r ? salaDe(r.espacio_id) : (partido?.[1] ?? m.detalle ?? '—');
      const horario = desde && hasta ? `${desde} a ${hasta}` : partido ? `${partido[2]} a ${partido[3]}` : '—';
      const horas = r
        ? hora(r.hasta_hora) - hora(r.desde_hora)
        : partido
          ? Number(partido[3].slice(0, 2)) - Number(partido[2].slice(0, 2))
          : 0;
      return { m, sala, horario, horas };
    });

  /**
   * Las horas del mes salen de los cargos y no de las reservas activas.
   *
   * Son las horas que se cobraron, que es lo que tiene que cuadrar con el
   * importe de al lado: una hora soltada fuera de plazo deja de estar en el
   * calendario y su cargo queda, así que contando reservas el resumen decía
   * "2 h · $ 28.280" cuando esos pesos eran siete horas.
   */
  const horasDelMes = consumos.reduce((n, c) => n + c.horas, 0);

  /**
   * Los últimos doce meses, con las horas que usó y lo que se le facturó.
   *
   * Se cuenta hacia atrás desde el mes de hoy y no desde el que se está
   * mirando: la historia es una sola y no tiene que moverse cuando alguien
   * navega a un mes viejo para revisar un pago.
   */
  const historia = Array.from({ length: MESES }, (_, k) => {
    const p = mesCorrido(periodoDe(hoy), k - (MESES - 1));
    return {
      periodo: p,
      etiqueta: mesCorto(p),
      horas: reservas
        .filter((r) => periodoDe(r.fecha) === p)
        .reduce((n, r) => n + (hora(r.hasta_hora) - hora(r.desde_hora)), 0),
      facturado: movimientos
        .filter((m) => m.periodo === p && m.tipo === 'cargo')
        .reduce((n, m) => n + m.importe, 0),
    };
  });

  const techoHoras = Math.max(...historia.map((m) => m.horas), 1);
  const techoPlata = Math.max(...historia.map((m) => m.facturado), 1);
  /** Un mes sin nada no dibuja barra: con un mínimo, doce vacíos parecen doce con algo. */
  const alto = (n: number, techo: number) => (n === 0 ? '0' : `${Math.max((n / techo) * 100, 3)}%`);

  const dir = (p: string) => `/os/consultorios/inquilino/${i.id}?periodo=${p}`;

  /*
   * Imprimir cuando la hoja ya está en la pantalla.
   *
   * `window.print` congela lo dibujado en ese momento, así que llamarlo en el
   * mismo clic imprime la pantalla sin la hoja. El efecto corre después del
   * dibujo, y `afterprint` la saca haya guardado el PDF o haya cancelado.
   */
  useEffect(() => {
    if (!imprimiendo) return;
    document.body.dataset.imprimir = imprimiendo;
    // El navegador le pone al archivo el título del documento, que es el de la
    // pantalla y saldría "Campos OS.pdf" para todos.
    const titulo = document.title;
    document.title =
      imprimiendo === 'recibo'
        ? `Recibo ${i.nombre}`
        : `${i.nombre} · ${mesLargo(periodo)}`;
    const fin = () => setImprimiendo(null);
    window.addEventListener('afterprint', fin);
    const cuadro = requestAnimationFrame(() => window.print());
    return () => {
      document.title = titulo;
      delete document.body.dataset.imprimir;
      window.removeEventListener('afterprint', fin);
      cancelAnimationFrame(cuadro);
    };
  }, [imprimiendo, i.nombre, periodo]);

  /**
   * El recibo de un pago.
   *
   * Se pide fila por fila y no de a uno por mes: en un mes puede haber dos
   * pagos, y un recibo dice qué se recibió y cuándo.
   */
  function imprimirRecibo(m: Movimiento) {
    setRecibo(m);
    // Un cuadro de espera para que la hoja se dibuje con ese pago adentro:
    // `window.print` congela lo que hay en pantalla en ese momento.
    requestAnimationFrame(() => setImprimiendo('recibo'));
  }

  async function generarEnlace() {
    const r = await mandar({ accion: 'inquilino-enlace', id: i.id });
    if (!r.ok || !r.enlace) return setError(r.motivo ?? 'No se pudo generar el enlace.');
    setError(null);
    setEnlace(r.enlace);
    try {
      await navigator.clipboard.writeText(r.enlace);
    } catch {
      // Si el navegador no deja copiar, el enlace igual queda a la vista.
    }
    router.refresh();
  }

  async function editar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setGuardando(true);
    const r = await mandar({
      accion: 'inquilino-editar',
      id: i.id,
      nombre: String(d.get('nombre') ?? ''),
      correo: String(d.get('correo') ?? ''),
      telefono: String(d.get('telefono') ?? ''),
      matricula: String(d.get('matricula') ?? ''),
      llaveEntregada: d.get('llave') === 'on',
      activo: d.get('activo') === 'on',
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setError(null);
    router.refresh();
  }

  async function cobrar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    const recargo = conRecargo && pct > 0 ? Math.round((saldo * pct) / 100) : 0;
    setGuardando(true);
    const r = await mandar({
      accion: 'pago-alta',
      inquilinoId: i.id,
      fecha: String(d.get('fecha') ?? ''),
      periodo,
      importe: Number(d.get('importe')),
      recargo,
      detalle: String(d.get('detalle') ?? ''),
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo registrar el pago.');
    setError(null);
    setCobrando(false);
    router.refresh();
  }

  async function borrarMovimiento(id: string) {
    const r = await mandar({ accion: 'movimiento-baja', id });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo borrar.');
    setError(null);
    router.refresh();
  }

  /* El legajo está al día con la matrícula cargada. La fecha de vencimiento se
     sacó el 8/9/2026: nadie la llevaba, así que exigirla habría dejado a todos
     sin poder reservar desde su pantalla. */
  const legajo = Boolean(i.matricula);

  return (
    <>
      {/* Arriba de todo y con la flecha, como en la ficha de un candidato: es
          de dónde se viene, no una acción de esta pantalla. */}
      <Link className="os-volver-enlace" href="/os/consultorios?ver=inquilinos">
        ← Volver a la lista
      </Link>

      <div className="os-encabezado">
        <h1>{i.nombre}</h1>
      </div>

      {error && <p className="os-form-error">{error}</p>}

      {/* Chicas, como las del calendario. */}
      <div className="os-cifras os-cifras-finas">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Contratado</div>
          <div className="os-cifra-valor">{horas} h</div>
          <div className="os-cifra-pie">por semana</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Cobradas</div>
          <div className="os-cifra-valor">{horasDelMes} h</div>
          <div className="os-cifra-pie">{mesLargo(periodo)}</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Del mes</div>
          <div className="os-cifra-valor">{pesos(cargos)}</div>
          <div className="os-cifra-pie">{pagos > 0 ? `pagó ${pesos(pagos)}` : 'sin pagos'}</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Debe</div>
          <div className="os-cifra-valor">{total === 0 ? 'Al día' : pesos(total)}</div>
          <div className="os-cifra-pie">
            {total !== saldo ? 'todos los meses' : pct > 0 ? `hoy ${pct}% de recargo` : 'sin recargo'}
          </div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Matrícula</div>
          <div className="os-cifra-valor">{i.matricula ?? 'Falta'}</div>
          <div className="os-cifra-pie">{legajo ? 'legajo completo' : 'sin ella no reserva'}</div>
        </div>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Sus datos</h2>
          <span className="os-columna-monto">
            {i.hash ? 'Entra al sistema' : i.correo ? 'Sin clave todavía' : 'No usa el sistema'}
          </span>
        </div>

        {/* En grilla y no en una fila que se estira: en flex, un nombre y una
            matrícula se llevaban el ancho entero del panel para mostrar diez
            caracteres, y las dos tildes quedaban colgadas al costado de la
            fecha. Acá cada campo mide un tercio y las tildes tienen su
            renglón. */}
        <form autoComplete="off" onSubmit={editar}>
          <div className="os-ficha-campos">
            <label className="os-etiqueta-campo">
              Nombre
              <input
                className="os-campo os-campo-suave"
                name="nombre"
                autoComplete="off"
                defaultValue={i.nombre}
              />
            </label>
            <label className="os-etiqueta-campo">
              Teléfono
              <input
                className="os-campo os-campo-suave"
                name="telefono"
                autoComplete="off"
                defaultValue={i.telefono ?? ''}
              />
            </label>
            <label className="os-etiqueta-campo">
              Correo
              <input
                className="os-campo os-campo-suave"
                name="correo"
                autoComplete="off"
                defaultValue={i.correo ?? ''}
              />
            </label>
            <label className="os-etiqueta-campo">
              Matrícula
              <input
                className="os-campo os-campo-suave"
                name="matricula"
                autoComplete="off"
                defaultValue={i.matricula ?? ''}
              />
            </label>
            <div className="os-ficha-tildes">
              <label className="os-tilde-fila">
                <input type="checkbox" name="llave" defaultChecked={i.llave_entregada} />
                Llave entregada
              </label>
              <label className="os-tilde-fila">
                <input type="checkbox" name="activo" defaultChecked={i.activo} />
                Activo
              </label>
            </div>

            {/* Los botones son la cuarta columna y no un pie: al pie, entre la
                fila de campos y ellos quedaba una franja vacía del ancho del
                panel, y "Guardar" caía lejos de lo último que se escribió. */}
            <div className="os-ficha-acciones">
              <button className="os-boton os-boton-firme" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                className="os-boton"
                type="button"
                onClick={generarEnlace}
                title={
                  i.hash
                    ? 'Genera un enlace de un solo uso para que vuelva a poner su contraseña'
                    : 'Genera un enlace de un solo uso para que ponga su contraseña y entre al sistema'
                }
              >
                {/* Un solo rótulo para los dos casos, y el que dice lo que
                    pasa al tocarlo: el enlace queda copiado y se manda por
                    WhatsApp. "Dar acceso" y "Restablecer clave" nombraban la
                    consecuencia, no la acción, y no se sabía qué esperar. */}
                Copiar enlace
              </button>
            </div>
          </div>
        </form>

        <p className="os-panel-nota">
          Normas aceptadas:{' '}
          {i.normas_aceptadas_at
            ? `versión ${i.normas_version ?? 'sin número'}, el ${dia(i.normas_aceptadas_at.slice(0, 10))}`
            : 'ninguna todavía'}
          .
        </p>

        {enlace && (
          <p className="os-panel-nota">
            Enlace copiado, vale 48 horas y una sola vez: <code>{enlace}</code>
          </p>
        )}
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            Lo que alquila{' '}
            <span className="os-panel-cuenta">· {horas} h por semana</span>
          </h2>
        </div>
        {vigentes.length === 0 ? (
          <p className="os-vacio">Hoy no tiene horas fijas. Lo que reserve va como hora suelta.</p>
        ) : (
          <table className="os-tabla os-tabla-fija">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Día</th>
                <th>Sala</th>
                <th>Horario</th>
                <th className="os-tabla-num">Horas</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {vigentes.map((c) => (
                <tr key={c.id}>
                  <td>{DIAS_CORTOS[c.dia_semana]}</td>
                  <td>{salaDe(c.espacio_id)}</td>
                  <td>
                    {c.desde_hora.slice(0, 5)} a {c.hasta_hora.slice(0, 5)}
                  </td>
                  <td className="os-tabla-num">{hora(c.hasta_hora) - hora(c.desde_hora)} h</td>
                  <td>{dia(c.vigente_desde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Las dos historias van juntas y no en dos paneles: las horas explican la
          plata, y separadas había que recordar la altura de una barra para
          compararla con la de al lado. */}
      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Histórico</h2>
          <span className="os-columna-monto">Los últimos {MESES} meses</span>
        </div>

        {/* Un solo gráfico y no dos al lado: las horas explican la plata, y
            separados había que recordar la altura de una barra para compararla
            con la de al lado. Cada serie con su escala, porque son horas y
            pesos: lo que se compara es la forma de las dos curvas, no su
            altura. */}
        <div className="os-mixto">
          <div className="os-mixto-lienzo">
            <div className="os-mixto-barras">
              {historia.map((m) => (
                <div
                  className="os-mixto-col"
                  key={m.periodo}
                  title={`${m.etiqueta}: ${m.horas} h · ${pesos(m.facturado)}`}
                >
                  {m.horas > 0 && (
                    <div
                      className="os-mixto-barra"
                      style={{ height: alto(m.horas, techoHoras) }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* La línea se estira con el lienzo (`preserveAspectRatio="none"`),
                así que su grosor se declara sin escalar; si no, en un panel
                ancho salía fina y aplastada. Pasa por todos los meses, también
                por los de cero: saltearlos dibujaba una línea que unía dos
                meses lejanos como si en el medio hubiera trabajo. */}
            <svg
              className="os-mixto-linea"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={curvaSuave(
                  historia.map((m, k) => ({
                    x: ((k + 0.5) / MESES) * 100,
                    y: 100 - (m.facturado / techoPlata) * 100,
                  }))
                )}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {historia.map((m, k) =>
              m.facturado > 0 ? (
                <i
                  className="os-mixto-punto"
                  key={m.periodo}
                  style={{
                    left: `${((k + 0.5) / MESES) * 100}%`,
                    bottom: `${(m.facturado / techoPlata) * 100}%`,
                  }}
                />
              ) : null
            )}
          </div>

          <div className="os-mixto-rotulos">
            {historia.map((m) => (
              <span key={m.periodo}>{m.etiqueta}</span>
            ))}
          </div>

          {/* Los máximos hacen de eje: sin ellos, dos escalas distintas en el
              mismo cuadro no dicen de cuánto es cada altura. */}
          <p className="os-referencias">
            <span className="os-referencia">
              <i className="os-referencia-color horas" /> Horas usadas · máximo {techoHoras} h
            </span>
            <span className="os-referencia">
              <i className="os-referencia-linea" /> Facturado · máximo {pesos(techoPlata)}
            </span>
          </p>
        </div>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            Resumen {mesLargo(periodo).replace(' de ', ' ')}
            {total !== saldo && (
              <span className="os-panel-cuenta"> · saldo total {pesos(total)}</span>
            )}
          </h2>
          {/* El botón va acá y no en el encabezado de la pantalla: lo que baja
              es el resumen del mes que se está mirando, y arriba, al lado del
              nombre, no se veía de qué mes hablaba. */}
          <div className="os-agenda-mover os-incluye-baja">
            <button className="os-boton" type="button" onClick={() => setImprimiendo('cuenta')}>
              Bajar el resumen
            </button>
            {/* El mismo control que el calendario: dos flechas y la vuelta al
                mes de hoy, en un solo grupo. Tres botones sueltos con el nombre
                escrito ocupaban el triple para decir lo mismo. */}
            <span className="os-nav-grupo">
              <Link
                className="os-nav-flecha"
                aria-label="Mes anterior"
                href={dir(mesCorrido(periodo, -1))}
              >
                ‹
              </Link>
              <Link href={dir(periodoDe(hoy))}>Este mes</Link>
              <Link
                className="os-nav-flecha"
                aria-label="Mes siguiente"
                href={dir(mesCorrido(periodo, 1))}
              >
                ›
              </Link>
            </span>
          </div>
        </div>

        {delMes.length === 0 ? (
          <p className="os-vacio">Este mes no tiene movimientos.</p>
        ) : (
          <table className="os-tabla os-tabla-fija">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '36%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Qué</th>
                <th>Detalle</th>
                <th className="os-tabla-num">Importe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {delMes.map((m) => (
                <tr key={m.id}>
                  <td>{dia(m.fecha)}</td>
                  <td>{NOMBRE[m.tipo]}</td>
                  <td>{detalleDe(m)}</td>
                  <td className="os-tabla-num">
                    {signo(m.tipo) < 0 ? '−' : ''}
                    {pesos(m.importe)}
                  </td>
                  <td className="os-tabla-accion">
                    {m.tipo === 'pago' && porBorrar !== m.id && (
                      <button
                        className="os-boton os-boton-fila"
                        type="button"
                        onClick={() => imprimirRecibo(m)}
                      >
                        Recibo
                      </button>
                    )}
                    {/* En dos pasos: un pago borrado de un clic es plata que
                        desaparece de la cuenta de alguien sin que nadie lo haya
                        decidido dos veces, y el movimiento no se puede
                        deshacer. */}
                    {m.tipo !== 'cargo' &&
                      (porBorrar === m.id ? (
                        <>
                          <button
                            className="os-boton os-boton-fila os-boton-peligro"
                            type="button"
                            onClick={() => {
                              setPorBorrar(null);
                              borrarMovimiento(m.id);
                            }}
                          >
                            Sí, borrar
                          </button>
                          <button
                            className="os-boton os-boton-fila"
                            type="button"
                            onClick={() => setPorBorrar(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          className="os-boton os-boton-fila os-boton-quitar"
                          type="button"
                          onClick={() => setPorBorrar(m.id)}
                        >
                          Borrar
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* El cobro va sobre blanco: los campos son `os-campo-suave`, del
            color del pie del panel, y ahí adentro no se veía dónde empezaba
            cada uno. El importe va tercero, que es el orden en que se carga un
            pago: cuándo, cómo y recién entonces cuánto, que es lo que se
            corrige mirando el saldo. */}
        {cobrando ? (
          <form
            className="os-incluye-alta os-panel-pie os-panel-pie-claro"
            autoComplete="off"
            onSubmit={cobrar}
          >
            <label className="os-etiqueta-campo">
              Fecha
              <input
                className="os-campo os-campo-suave"
                type="date"
                name="fecha"
                defaultValue={hoy}
                required
              />
            </label>
            <label className="os-etiqueta-campo">
              Cómo
              {/* Con el ancho de la fila, "Transferencia" quedaba en un campo
                  de setecientos píxeles. Mide lo que mide su opción más larga. */}
              <select
                className="os-campo os-campo-suave os-campo-medio"
                name="detalle"
                defaultValue="Transferencia"
              >
                <option>Transferencia</option>
                <option>Efectivo</option>
              </select>
            </label>
            <label className="os-etiqueta-campo">
              Importe
              <input
                className="os-campo os-campo-suave os-campo-corto"
                name="importe"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={Math.round(saldo + (conRecargo && pct > 0 ? (saldo * pct) / 100 : 0))}
                required
              />
            </label>
            {pct > 0 && (
              <label className="os-tilde-fila">
                <input
                  type="checkbox"
                  checked={conRecargo}
                  onChange={(e) => setConRecargo(e.target.checked)}
                />
                Sumar {pct}% ({pesos(Math.round((saldo * pct) / 100))})
              </label>
            )}
            <button className="os-boton os-boton-firme" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Registrar'}
            </button>
            <button className="os-boton" type="button" onClick={() => setCobrando(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <div className="os-incluye-alta os-panel-pie">
            {/* Cómo viene la cuenta primero y la acción a la derecha: se lee de
                izquierda a derecha, y el botón queda del lado donde termina la
                lectura. */}
            <span className="os-panel-nota">
              {saldo > 0
                ? `Debe ${pesos(saldo)} de ${mesLargo(periodo)}.`
                : saldo < 0
                  ? `Tiene ${pesos(-saldo)} a favor.`
                  : 'Está al día con este mes.'}
            </span>
            <button
              className="os-boton os-boton-firme os-boton-derecha"
              type="button"
              onClick={() => setCobrando(true)}
            >
              Registrar un pago
            </button>
          </div>
        )}
      </div>

      {/* El recibo de un pago, con el membrete del Centro.
          Dice que es un comprobante interno: hoy nadie factura el alquiler de
          las salas, y un papel que parece una factura sin serlo le crea un
          problema al que lo recibe y al que lo firma. */}
      {montado &&
        recibo &&
        createPortal(
          <section className="os-papel-recibo" aria-hidden="true">
          <div className="os-papel-marca">
            <span className="os-papel-nombre">Centro Integral Santiago</span>
            <span className="os-papel-sitio">Santiago 1269, Rosario</span>
          </div>

          <h1 className="os-papel-titulo">Recibo de pago</h1>
          <p className="os-papel-referencia">N.º {recibo.id.slice(0, 8).toUpperCase()}</p>

          <dl className="os-papel-datos">
            <div>
              <dt>Recibí de</dt>
              <dd>{i.nombre}</dd>
            </div>
            <div>
              <dt>La suma de</dt>
              <dd>
                <strong>{pesos(recibo.importe)}</strong>
              </dd>
            </div>
            <div>
              <dt>En concepto de</dt>
              <dd>
                Alquiler de consultorio · {mesLargo(recibo.periodo ?? periodo)}
              </dd>
            </div>
            <div>
              <dt>Forma de pago</dt>
              <dd>{recibo.detalle ?? 'Sin especificar'}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{fechaLarga(recibo.fecha)}</dd>
            </div>
          </dl>

          {/* A la izquierda, que es donde firma quien emite. Sin línea entre el
              trazo y el nombre: con el trazo dibujado, esa raya lo partía en
              dos en vez de sostenerlo. Queda para el día que no haya trazo
              cargado, que ahí se firma a mano. */}
          <div className="os-papel-firma">
            {firma?.trazo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="os-papel-trazo" src={firma.trazo} alt="" />
            )}
            <span>
              {firma?.nombre ?? 'Firma y aclaración'}
              {firma && (
                <>
                  <br />
                  {firma.cargo}
                </>
              )}
            </span>
          </div>

            <p className="os-papel-pie">
              Comprobante interno de pago, sin validez fiscal. Emitido el {fechaLarga(hoy)}.
            </p>
          </section>,
          document.body
        )}

      {/* La hoja que se manda. Vive acá y no en otra ruta: lo que se imprime es
          la misma cuenta que se está mirando, y una segunda versión se separa
          de esta en la primera corrección. */}
      {montado &&
        createPortal(
          <section className="os-papel-cuenta" aria-hidden="true">
        <div className="os-papel-marca">
          <span className="os-papel-nombre">Centro Integral Santiago</span>
          <span className="os-papel-sitio">Santiago 1269, Rosario</span>
        </div>

        <h1 className="os-papel-titulo">
          {i.nombre} · {mesLargo(periodo)}
        </h1>
        <p className="os-papel-pie">Emitido el {fechaLarga(hoy)}</p>

        {/* Las horas por un lado y el dinero por el otro: mezclados en una
            sola lista, un pago quedaba entre dos reservas y no se veía cuánto
            se usó ni cuánto se cobró por eso. */}
        <h2 className="os-papel-seccion">Las horas del mes</h2>
        <table className="os-papel-tabla os-papel-consumos">
          <thead>
            <tr>
              <th>Día</th>
              <th>Sala</th>
              <th>Horario</th>
              <th className="os-papel-num">Horas</th>
              <th className="os-papel-num">Precio hora</th>
              <th className="os-papel-num">Importe</th>
            </tr>
          </thead>
          <tbody>
            {consumos.length === 0 && (
              <tr>
                <td colSpan={6}>No usó el Centro este mes.</td>
              </tr>
            )}
            {consumos.map((c) => (
              <tr key={c.m.id}>
                <td>
                  {DIAS_CORTOS[diaSemanaDe(c.m.fecha)]} {dia(c.m.fecha)}
                </td>
                <td>{c.sala}</td>
                <td>{c.horario}</td>
                <td className="os-papel-num">{c.horas > 0 ? `${c.horas} h` : '—'}</td>
                <td className="os-papel-num">
                  {c.horas > 0 ? pesos(Math.round(c.m.importe / c.horas)) : '—'}
                </td>
                <td className="os-papel-num">{pesos(c.m.importe)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="os-papel-total">
              <td colSpan={3}>Total del mes</td>
              <td className="os-papel-num">{horasDelMes} h</td>
              <td />
              <td className="os-papel-num">{pesos(cargos)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Todo lo que no es una hora de consultorio: pagos, recargos,
            créditos por horas soltadas y ajustes. */}
        {delMes.some((m) => m.tipo !== 'cargo') && (
          <>
            <h2 className="os-papel-seccion">Pagos y ajustes</h2>
            <table className="os-papel-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="os-papel-num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {delMes
                  .filter((m) => m.tipo !== 'cargo')
                  .slice()
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{dia(m.fecha)}</td>
                      <td>
                        {NOMBRE[m.tipo]}
                        {m.detalle ? ` · ${m.detalle}` : ''}
                      </td>
                      <td className="os-papel-num">
                        {signo(m.tipo) < 0 ? '−' : ''}
                        {pesos(m.importe)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        <table className="os-papel-tabla os-papel-cierre">
          <tbody>
            <tr>
              <td>Horas usadas · {horasDelMes} h</td>
              <td className="os-papel-num">{pesos(cargos)}</td>
            </tr>
            <tr>
              <td>Pagos registrados</td>
              <td className="os-papel-num">− {pesos(pagos)}</td>
            </tr>
            <tr className="os-papel-total">
              <td>{saldo < 0 ? 'A favor' : saldo === 0 ? 'Saldo del mes' : 'Saldo a pagar'}</td>
              <td className="os-papel-num">{pesos(Math.abs(saldo))}</td>
            </tr>
            {total !== saldo && (
              <tr>
                <td>Saldo de todos los meses</td>
                <td className="os-papel-num">{pesos(total)}</td>
              </tr>
            )}
          </tbody>
        </table>

            {/* Con la cuenta hecha y no solo la regla: "del 11 al 20 corre un
                15 %" obliga a quien lo recibe a sacar el porcentaje de su
                propio saldo, y el que quiere pagar necesita el número, no la
                fórmula. */}
            {saldo > 0 ? (
              <table className="os-papel-tabla os-papel-plazos">
                <tbody>
                  <tr>
                    <td>Pagando hasta el 10 de {soloMes(periodo)}</td>
                    <td className="os-papel-num">{pesos(saldo)}</td>
                  </tr>
                  <tr>
                    <td>Del 11 al 20, con el 15 % de recargo</td>
                    <td className="os-papel-num">{pesos(Math.round(saldo * 1.15))}</td>
                  </tr>
                  <tr>
                    <td>Del 21 en adelante, con el 25 %</td>
                    <td className="os-papel-num">{pesos(Math.round(saldo * 1.25))}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              /* Con el mes saldado no se habla de recargos: la regla del 15 y
                 el 25 % es sobre lo que se debe, y sin deuda es una advertencia
                 sobre algo que no existe. */
              <p className="os-papel-pie">
                {saldo === 0 ? 'El mes está saldado.' : `Queda ${pesos(-saldo)} a favor.`}
              </p>
            )}
          </section>,
          document.body
        )}
    </>
  );
}
