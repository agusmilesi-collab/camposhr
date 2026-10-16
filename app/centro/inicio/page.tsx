import Link from 'next/link';
import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import {
  contratos as leerContratos,
  DIAS_CORTOS,
  finDeMes,
  horasSemanalesTotales,
  diaSemanaDe,
  hora,
  hoyISO,
  listarEspacios,
  mesCorrido,
  mesLargo,
  movimientosDe,
  periodoDe,
  recargoDelDia,
  reservasDe,
  saldoDe,
  sumarDias,
} from '@/lib/consultorios';
import { facturasDelCentro } from '@/lib/facturas-centro';
import { DIA_DE_RENOVAR, renovacionDe } from '@/lib/renovaciones';
import { feriadosEntre } from '@/lib/feriados';
import { turnosDe } from '@/lib/turnos';
import Renovar from './Renovar';
import Asistencia from './Asistencia';
import { NORMAS_VERSION } from '@/lib/centro-acceso';
import Barra from '../Barra';

export const dynamic = 'force-dynamic';

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Las novedades se quedan una semana en Hoy: después ya no son de hoy, y
 *  el papel sigue estando en Mi cuenta. */
const DIAS_EN_HOY = 7;

function diaCorto(iso: string): string {
  return `${DIAS_CORTOS[diaSemanaDe(iso)]} ${new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(`${iso}T12:00:00-03:00`))}`;
}

type Tarjeta = {
  clave: string;
  titulo: string;
  detalle: string | null;
  /** El importe o la hora, a la derecha del título. */
  dato?: string;
  enlace?: { href: string; texto: string; afuera?: boolean };
  /** Un aviso se pinta distinto de una reserva: pide mirar algo. */
  aviso?: boolean;
  /** Un aviso en rojo: una deuda que ya lleva recargo. */
  urgente?: boolean;
  /** Hora por hora de la reserva: a quién atiende, o libre. Solo en modo mirar. */
  horas?: { hora: number; paciente: string | null; fichaId: string | null }[];
  /** La tarjeta es un turno: lleva el circulito de si vino. */
  turno?: { id: string; asistio: boolean | null };
};

/**
 * El inicio del inquilino: un tablero de tres columnas, como el del equipo.
 *
 *   Hoy                 lo que le llegó (la factura emitida, el pago que ya
 *                       está registrado, el mes que tiene para pagar) y las
 *                       horas que tiene reservadas hoy.
 *   Mañana              las horas de mañana.
 *   Próximos días       el resto de la semana que sigue.
 *
 * **Las novedades se leen de lo que ya está guardado**, no de una lista de
 * avisos aparte: una factura emitida y un pago registrado son el aviso. Así no
 * hay forma de que diga "registramos tu pago" sobre un pago que después se
 * borró, ni de que una factura salga sin su novedad.
 */
export default async function Inicio(props: { searchParams: Promise<{ hoy?: string }> }) {
  const searchParams = await props.searchParams;
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  // Fuera de producción el día se puede fingir con `?hoy=2026-10-25`, para
  // mirar cómo queda la pantalla un día que todavía no llegó. Publicado, el
  // día es siempre el de hoy.
  const fingido =
    process.env.NODE_ENV !== 'production' && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.hoy ?? '')
      ? (searchParams.hoy as string)
      : null;
  const hoy = fingido ?? hoyISO();
  const manana = sumarDias(hoy, 1);
  const hasta = sumarDias(hoy, 7);
  const desde = sumarDias(hoy, -DIAS_EN_HOY);
  const mesActual = periodoDe(hoy);

  const proximoMes = mesCorrido(periodoDe(hoy), 1);

  const [facturas, movimientos, reservas, espacios, contratos, renovacion, turnos] = await Promise.all([
    facturasDelCentro(yo.id),
    movimientosDe(yo.id),
    reservasDe(yo.id),
    listarEspacios(),
    leerContratos(),
    renovacionDe(yo.id, proximoMes),
    // A quién atiende lo ve solo la persona: en modo mirar no se trae.
    yo.mirando ? Promise.resolve([]) : turnosDe(yo.id, hoy, hasta),
  ]);
  const feriadosProximos = await feriadosEntre(proximoMes, finDeMes(proximoMes));
  const salaDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';

  // Cada hora de la reserva con su paciente, si lo anotó en Mis turnos. La
  // tarjeta deja de ser "Consultorio 2, 10 a 13" y pasa a decir a quién ve.
  const horasDe = (r: (typeof reservas)[number]) =>
    yo.mirando
      ? undefined
      : Array.from({ length: hora(r.hasta_hora) - hora(r.desde_hora) }, (_, i) => {
          const h = hora(r.desde_hora) + i;
          const t = turnos.find((x) => x.fecha === r.fecha && Number(x.desde_hora.slice(0, 2)) === h);
          return { hora: h, paciente: t?.paciente ?? null, fichaId: t?.paciente_id ?? null };
        });
  /**
   * Las tarjetas de una reserva: una por paciente anotado en Mis turnos, con
   * su hora, la sala, el circulito de si vino y el botón a la ficha; y una
   * más, si quedan horas sin anotar, para ir a anotarlas. En modo mirar desde
   * el OS no hay pacientes: sale la reserva sola.
   */
  const deReserva = (r: (typeof reservas)[number], conDia: boolean): Tarjeta[] => {
    const cuando = conDia ? `${diaCorto(r.fecha)} · ` : '';
    if (yo.mirando) {
      return [
        {
          clave: r.id,
          titulo: salaDe(r.espacio_id),
          detalle: `${cuando}${r.desde_hora.slice(0, 5)} a ${r.hasta_hora.slice(0, 5)}`,
          dato: `${hora(r.hasta_hora) - hora(r.desde_hora)} h`,
        },
      ];
    }
    const horas = horasDe(r) ?? [];
    const conPaciente = horas.filter((x) => x.paciente);
    const libres = horas.filter((x) => !x.paciente);
    const tarjetas: Tarjeta[] = conPaciente.map((x) => {
      const t = turnos.find((y) => y.fecha === r.fecha && Number(y.desde_hora.slice(0, 2)) === x.hora);
      return {
        clave: `${r.id}|${x.hora}`,
        titulo: x.paciente as string,
        detalle: `${cuando}${String(x.hora).padStart(2, '0')}:00 · ${salaDe(r.espacio_id)}`,
        turno: t ? { id: t.id, asistio: t.asistio } : undefined,
        enlace: x.fichaId
          ? { href: `/centro/pacientes/${x.fichaId}`, texto: 'Ver la ficha' }
          : { href: '/centro/turnos', texto: 'Ver en Mis turnos' },
      };
    });
    if (libres.length > 0) {
      tarjetas.push({
        clave: `${r.id}|libres`,
        titulo: salaDe(r.espacio_id),
        detalle: `${cuando}Sin anotar: ${libres.map((x) => `${x.hora}:00`).join(', ')}`,
        dato: `${libres.length} h`,
        enlace: { href: '/centro/turnos', texto: 'Anotar turnos' },
      });
    }
    return tarjetas;
  };
  /**
   * Las reservas pegadas de la misma sala y el mismo día van en una tarjeta:
   * quien reservó de 10 a 13 y después sumó de 13 a 19 tiene una mañana y una
   * tarde seguidas, no dos reservas. Se unen cuando una termina donde empieza
   * la otra; con un hueco en el medio siguen separadas.
   */
  const unidas = (lista: typeof reservas) => {
    const ordenadas = [...lista].sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || a.espacio_id.localeCompare(b.espacio_id) || a.desde_hora.localeCompare(b.desde_hora)
    );
    const salida: typeof reservas = [];
    for (const r of ordenadas) {
      const u = salida[salida.length - 1];
      if (u && u.fecha === r.fecha && u.espacio_id === r.espacio_id && u.hasta_hora === r.desde_hora) {
        salida[salida.length - 1] = { ...u, hasta_hora: r.hasta_hora };
      } else {
        salida.push({ ...r });
      }
    }
    return salida;
  };
  const proximas = unidas(reservas.filter((r) => r.fecha >= hoy && r.fecha <= hasta));

  // Lo que debe, con el recargo que corra hoy: el mes se paga por adelantado,
  // y si arrastra uno anterior, ese va primero.
  const conDeuda = [...new Set(movimientos.map((m) => m.periodo).filter((x): x is string => Boolean(x)))]
    .filter((p) => p <= mesActual && saldoDe(movimientos.filter((m) => m.periodo === p)) > 0)
    .sort();
  const mesAPagar = conDeuda[0] ?? mesActual;
  const saldoAPagar = saldoDe(movimientos.filter((m) => m.periodo === mesAPagar));
  const aPagar = Math.round(saldoAPagar * (1 + recargoDelDia(hoy, mesAPagar) / 100));

  const avisos: (Tarjeta & { fecha: string })[] = [
    // Solo las emitidas: un borrador todavía no es una factura, y una anulada
    // ya no vale como papel.
    ...facturas
      .filter((f) => f.estado === 'emitida' && f.fecha >= desde)
      .map((f) => ({
        clave: `f-${f.id}`,
        fecha: f.fecha,
        titulo: 'Se emitió tu factura',
        detalle: f.periodo ? mesLargo(`${f.periodo.slice(0, 7)}-01`) : null,
        dato: f.importe === null ? undefined : pesos(f.importe),
        enlace: { href: `/api/centro/factura-pdf/${f.id}`, texto: 'Abrir la factura', afuera: true },
        aviso: true,
      })),
    ...movimientos
      .filter((m) => m.tipo === 'pago' && m.fecha >= desde)
      .map((m) => ({
        clave: `p-${m.id}`,
        fecha: m.fecha,
        titulo: 'Registramos tu pago',
        detalle: m.periodo ? `Alquiler de ${mesLargo(m.periodo)}` : null,
        dato: pesos(m.importe),
        enlace: { href: `/api/centro/recibo/${m.id}`, texto: 'Abrir el recibo', afuera: true },
        aviso: true,
      })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  /*
   * La renovación: desde el 25, y solo a quien tiene horas fijas.
   *
   * Sin bandas no hay nada que renovar: quien viene por horas sueltas las
   * reserva cuando las necesita. Las horas son las de sus contratos vigentes.
   */
  const horasFijas = horasSemanalesTotales(contratos, yo.id, hoy);
  const preguntaRenovar = Number(hoy.slice(8, 10)) >= DIA_DE_RENOVAR && horasFijas > 0;
  // Las normas: la primera vez que entra y cada vez que cambian de versión.
  const pideNormas = yo.normas_version !== NORMAS_VERSION;
  const extrasDeHoy = preguntaRenovar ? 1 : 0;

  /*
   * Los feriados del mes que viene que caen en un día en que tiene horas.
   *
   * El Centro cierra los feriados, y por eso se le avisa al renovar: ese día
   * su sala no se reserva, salvo que diga que la quiere igual. Los de los
   * días en que no viene no se le muestran, que no le cambian nada.
   */
  const mios = contratos.filter(
    (c) => c.inquilino_id === yo.id && (c.vigente_hasta === null || c.vigente_hasta >= proximoMes)
  );
  const feriadosSuyos = feriadosProximos
    .map((f) => ({
      fecha: f.fecha,
      nombre: f.nombre,
      dia: diaCorto(f.fecha),
      horas: mios
        .filter((c) => c.dia_semana === diaSemanaDe(f.fecha))
        .reduce((n, c) => n + (hora(c.hasta_hora) - hora(c.desde_hora)), 0),
    }))
    .filter((f) => f.horas > 0);

  const columnas: { titulo: string; vacio: string; tarjetas: Tarjeta[] }[] = [
    {
      titulo: 'Hoy',
      vacio: 'Nada para hoy',
      tarjetas: [
        // Los pacientes del día van primero: es lo que se mira al llegar.
        ...proximas.filter((r) => r.fecha === hoy).flatMap((r) => deReserva(r, false)),
        // Las normas y el manual, mientras falte aceptar la versión vigente:
        // la primera vez que entra y cada vez que cambian. El botón de
        // aceptar está al pie de la hoja de normas, para que llegue al final.
        ...(pideNormas
          ? [
              {
                clave: 'normas',
                titulo: yo.normas_aceptadas_at ? 'Las normas y condiciones cambiaron' : 'Normas de convivencia',
                detalle: 'Leelas y aceptalas al final para poder reservar',
                enlace: { href: '/centro/normas', texto: 'Leer las normas' },
                aviso: true,
              },
              {
                clave: 'manual',
                titulo: 'Manual del sistema',
                detalle: 'Cómo se reserva, se paga y se renueva',
                enlace: { href: '/centro/manual', texto: 'Leer el manual' },
                aviso: true,
              },
            ]
          : []),
        ...(aPagar > 0
          ? [
              {
                clave: 'pagar',
                titulo: `Pagar ${mesLargo(mesAPagar).split(' ')[0]}`,
                detalle:
                  aPagar > saldoAPagar ? 'Ya lleva recargo' : 'Hasta el 10, sin recargo',
                dato: pesos(aPagar),
                enlace: { href: '/centro/cuenta#pagar', texto: 'Ver cómo se paga' },
                aviso: true,
                urgente: aPagar > saldoAPagar,
              },
            ]
          : []),
        ...avisos,
      ],
    },
    {
      titulo: 'Mañana',
      vacio: 'Sin reservas',
      tarjetas: proximas.filter((r) => r.fecha === manana).flatMap((r) => deReserva(r, false)),
    },
    {
      titulo: 'Próximos días',
      vacio: 'Sin reservas',
      tarjetas: proximas.filter((r) => r.fecha > manana).flatMap((r) => deReserva(r, true)),
    },
  ];

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/inicio" />
      <main className="centro-cuerpo centro-cuerpo-ancho">
        <h1 className="centro-titulo">Hola, {yo.nombre.split(' ')[0]}</h1>
        <p className="centro-bajada">Lo que tenés hoy, lo que viene y lo que te llegó.</p>

        <div className="centro-tablero">
          {columnas.map((c) => (
            <section className="centro-columna" key={c.titulo}>
              <header>
                <h2>{c.titulo}</h2>
                <span>{c.tarjetas.length + (c.titulo === 'Hoy' ? extrasDeHoy : 0)}</span>
              </header>
              {c.titulo === 'Hoy' && preguntaRenovar && (
                <Renovar
                  mes={mesLargo(proximoMes).split(' ')[0]}
                  horas={horasFijas}
                  respuesta={renovacion?.respuesta ?? null}
                  nota={renovacion?.nota ?? null}
                  feriados={feriadosSuyos}
                  tildados={renovacion?.feriados ?? []}
                />
              )}
              {c.tarjetas.length === 0 && !(c.titulo === 'Hoy' && extrasDeHoy > 0) && (
                <p className="centro-columna-vacia">{c.vacio}</p>
              )}
              {c.tarjetas.map((t) => (
                <article
                  className={`centro-tarjeta${t.aviso ? ' aviso' : ''}${t.urgente ? ' urgente' : ''}${t.horas ? ' con-horas' : ''}`}
                  key={t.clave}
                >
                  <div className="centro-tarjeta-top">
                    <b>{t.titulo}</b>
                    {t.dato && <span>{t.dato}</span>}
                    {t.turno && <Asistencia id={t.turno.id} asistio={t.turno.asistio} />}
                  </div>
                  {t.detalle && <small>{t.detalle}</small>}
                  {t.horas && (
                    <ul className="centro-tarjeta-horas">
                      {t.horas.map((x) => (
                        <li key={x.hora} className={x.paciente ? undefined : 'libre'}>
                          <span>{String(x.hora).padStart(2, '0')}:00</span>
                          {x.paciente ? (
                            <Link href={x.fichaId ? `/centro/pacientes/${x.fichaId}` : '/centro/turnos'}>
                              {x.paciente}
                            </Link>
                          ) : (
                            <Link href="/centro/turnos">libre</Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.enlace && (
                    <a
                      className="centro-tarjeta-boton"
                      href={t.enlace.href}
                      {...(t.enlace.afuera ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {t.enlace.texto}
                    </a>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
