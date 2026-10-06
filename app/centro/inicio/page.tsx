import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import {
  DIAS_CORTOS,
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
export default async function Inicio() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const hoy = hoyISO();
  const manana = sumarDias(hoy, 1);
  const hasta = sumarDias(hoy, 7);
  const desde = sumarDias(hoy, -DIAS_EN_HOY);
  const mesAnterior = mesCorrido(periodoDe(hoy), -1);

  const [facturas, movimientos, reservas, espacios] = await Promise.all([
    facturasDelCentro(yo.id),
    movimientosDe(yo.id),
    reservasDe(yo.id),
    listarEspacios(),
  ]);
  const salaDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';

  const deReserva = (r: (typeof reservas)[number], conDia: boolean): Tarjeta => ({
    clave: r.id,
    titulo: salaDe(r.espacio_id),
    detalle: `${conDia ? `${diaCorto(r.fecha)} · ` : ''}${r.desde_hora.slice(0, 5)} a ${r.hasta_hora.slice(0, 5)}`,
    dato: `${hora(r.hasta_hora) - hora(r.desde_hora)} h`,
  });
  const proximas = reservas.filter((r) => r.fecha >= hoy && r.fecha <= hasta);

  // Lo que debe del mes que cerró, con el recargo que corra hoy.
  const saldoAnterior = saldoDe(movimientos.filter((m) => m.periodo === mesAnterior));
  const aPagar = Math.round(saldoAnterior * (1 + recargoDelDia(hoy, mesAnterior) / 100));

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

  const columnas: { titulo: string; vacio: string; tarjetas: Tarjeta[] }[] = [
    {
      titulo: 'Hoy',
      vacio: 'Nada para hoy',
      tarjetas: [
        ...(aPagar > 0
          ? [
              {
                clave: 'pagar',
                titulo: `Tenés ${mesLargo(mesAnterior).split(' ')[0]} para pagar`,
                detalle:
                  aPagar > saldoAnterior ? 'Ya lleva recargo' : 'Hasta el 10, sin recargo',
                dato: pesos(aPagar),
                enlace: { href: '/centro/cuenta?ver=pagar', texto: 'Ver cómo se paga' },
                aviso: true,
              },
            ]
          : []),
        ...avisos,
        ...proximas.filter((r) => r.fecha === hoy).map((r) => deReserva(r, false)),
      ],
    },
    {
      titulo: 'Mañana',
      vacio: 'Sin reservas',
      tarjetas: proximas.filter((r) => r.fecha === manana).map((r) => deReserva(r, false)),
    },
    {
      titulo: 'Próximos días',
      vacio: 'Sin reservas',
      tarjetas: proximas.filter((r) => r.fecha > manana).map((r) => deReserva(r, true)),
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
                <span>{c.tarjetas.length}</span>
              </header>
              {c.tarjetas.length === 0 && <p className="centro-columna-vacia">{c.vacio}</p>}
              {c.tarjetas.map((t) => (
                <article className={`centro-tarjeta${t.aviso ? ' aviso' : ''}`} key={t.clave}>
                  <div className="centro-tarjeta-top">
                    <b>{t.titulo}</b>
                    {t.dato && <span>{t.dato}</span>}
                  </div>
                  {t.detalle && <small>{t.detalle}</small>}
                  {t.enlace && (
                    <a
                      className="centro-bajar centro-abrir"
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
