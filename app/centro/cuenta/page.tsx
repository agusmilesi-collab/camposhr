import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import {
  DIAS_CORTOS,
  diaSemanaDe,
  hora,
  hoyISO,
  listarEspacios,
  mesLargo,
  movimientos as leerMovimientos,
  periodoDe,
  recargoDelDia,
  reservasEntre,
  saldoDe,
  signo,
} from '@/lib/consultorios';
import Barra from '../Barra';

export const dynamic = 'force-dynamic';

/**
 * La cuenta del inquilino: lo del mes, lo que pagó y lo que debe.
 *
 * Es la otra mitad de lo que hoy se pregunta por WhatsApp. Muestra el recargo
 * que corre hoy, porque el documento de convivencia lo fija por fecha: del 1 al
 * 10 sin recargo, después 15%, y del 21 en adelante 25%.
 *
 * Los movimientos se filtran por la persona de la cookie firmada, nunca por un
 * identificador que venga de la dirección.
 */

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

const NOMBRE: Record<string, string> = {
  cargo: 'Reserva',
  pago: 'Pago',
  recargo: 'Recargo',
  credito: 'Crédito',
  ajuste: 'Ajuste',
};

export default async function Cuenta({ searchParams }: { searchParams: { mes?: string } }) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const hoy = hoyISO();
  const periodo = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.mes ?? '')
    ? (searchParams.mes as string)
    : periodoDe(hoy);

  const finDeMes = new Date(
    Number(periodo.slice(0, 4)),
    Number(periodo.slice(5, 7)),
    0
  );
  const hasta = `${periodo.slice(0, 8)}${String(finDeMes.getDate()).padStart(2, '0')}`;

  const [todos, reservas, espacios] = await Promise.all([
    leerMovimientos(),
    reservasEntre(periodo, hasta),
    listarEspacios(),
  ]);
  const mios = todos.filter((m) => m.inquilino_id === yo.id);
  const delMes = mios.filter((m) => m.periodo === periodo);
  const saldo = saldoDe(delMes);
  const total = saldoDe(mios);
  const pct = recargoDelDia(hoy, periodo);

  const cargos = delMes.filter((m) => m.tipo === 'cargo').reduce((n, m) => n + m.importe, 0);
  const pagos = delMes.filter((m) => m.tipo === 'pago').reduce((n, m) => n + m.importe, 0);

  /**
   * Las horas del mes, una por una, con lo que costó cada una.
   *
   * Es el mismo detalle que las propietarias bajan en PDF, pero acá se lee en
   * pantalla: un renglón que dice "$ 13.220" y nada más obliga a preguntar de
   * dónde salió, que es el WhatsApp que este sistema viene a sacar. Sala y
   * horario salen de la reserva; si la reserva ya no está, del detalle que se
   * guardó con el movimiento.
   */
  const salaDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';
  const consumos = delMes
    .filter((m) => m.tipo === 'cargo')
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => {
      const r = reservas.find((x) => x.id === m.reserva_id);
      // La sala y el horario se leen del principio del detalle y no de todo él:
      // a un cargo liberado se le anexa la aclaración, y exigiendo que la
      // cadena termine en la hora ese renglón salía sin sala ni horario.
      const partido = /^(.*?), (\d{2}:\d{2}) a (\d{2}:\d{2})(?: ·.*)?$/.exec(m.detalle ?? '');
      const horas = r
        ? hora(r.hasta_hora) - hora(r.desde_hora)
        : partido
          ? Number(partido[3].slice(0, 2)) - Number(partido[2].slice(0, 2))
          : 0;
      return {
        m,
        sala: r ? salaDe(r.espacio_id) : (partido?.[1] ?? '—'),
        horario: r
          ? `${r.desde_hora.slice(0, 5)} a ${r.hasta_hora.slice(0, 5)}`
          : partido
            ? `${partido[2]} a ${partido[3]}`
            : '—',
        horas,
        // Lo que quedó anotado cuando una hora se soltó fuera de plazo: sin
        // esto, en la cuenta aparece una hora que ya no está en el calendario.
        liberada: (m.detalle ?? '').includes('se cobra igual'),
      };
    });
  const horasDelMes = consumos.reduce((n, c) => n + c.horas, 0);

  const otroMes = (n: number) => {
    const d = new Date(`${periodo}T12:00:00-03:00`);
    d.setMonth(d.getMonth() + n);
    return periodoDe(d.toISOString().slice(0, 10));
  };

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/cuenta" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Tu cuenta</h1>
        <p className="centro-bajada">
          El alquiler se paga del 1 al 10 del mes. Del 11 al 20 lleva 15% de
          recargo y del 21 en adelante, 25%.
        </p>

        <div className="centro-panel">
          <h2>{mesLargo(periodo)}</h2>
          <div className="centro-saldo">{saldo <= 0 ? 'Al día' : pesos(saldo)}</div>
          <p className="centro-nota">
            {saldo <= 0
              ? 'No hay nada pendiente de este mes.'
              : pct > 0
                ? `Hoy este saldo lleva ${pct}% de recargo: ${pesos(Math.round(saldo * (1 + pct / 100)))}.`
                : `Hasta el 10 se paga sin recargo.`}
            {total !== saldo && ` Tu saldo total, contando todos los meses, es ${pesos(total)}.`}
          </p>
        </div>

        {/* El mismo detalle que las propietarias bajan en PDF, leído en
            pantalla: qué día, en qué sala, de qué hora a qué hora, cuántas
            horas y a cuánto. Un renglón que dice "$ 13.220" y nada más obliga a
            preguntar de dónde salió. */}
        <div className="centro-panel">
          <div className="centro-fila" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Las horas del mes</h2>
            <span className="centro-meses">
              <a href={`/centro/cuenta?mes=${otroMes(-1)}`}>‹</a>
              <a href={`/centro/cuenta?mes=${periodoDe(hoy)}`}>Este mes</a>
              <a href={`/centro/cuenta?mes=${otroMes(1)}`}>›</a>
            </span>
          </div>

          {consumos.length === 0 ? (
            <p className="centro-nota">Este mes no usaste el Centro.</p>
          ) : (
            <table className="centro-resumen">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Consultorio</th>
                  <th>Horario</th>
                  <th className="centro-num">Horas</th>
                  <th className="centro-num">La hora</th>
                  <th className="centro-num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {consumos.map((c) => (
                  <tr key={c.m.id}>
                    <td>
                      {DIAS_CORTOS[diaSemanaDe(c.m.fecha)]} {dia(c.m.fecha)}
                    </td>
                    <td>
                      {c.sala}
                      {c.liberada && <small className="centro-liberada"> · liberada</small>}
                    </td>
                    <td>{c.horario}</td>
                    <td className="centro-num">{c.horas > 0 ? `${c.horas} h` : '—'}</td>
                    <td className="centro-num">
                      {c.horas > 0 ? pesos(Math.round(c.m.importe / c.horas)) : '—'}
                    </td>
                    <td className="centro-num">{pesos(c.m.importe)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total del mes</td>
                  <td className="centro-num">{horasDelMes} h</td>
                  <td />
                  <td className="centro-num">{pesos(cargos)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {consumos.some((c) => c.liberada) && (
            <p className="centro-nota">
              Las horas marcadas como liberadas se soltaron fuera del plazo de siete días: la sala
              volvió al calendario para venderse de nuevo, y la hora se cobra igual, como dice el
              documento de convivencia.
            </p>
          )}
        </div>

        {delMes.some((m) => m.tipo !== 'cargo') && (
          <div className="centro-panel">
            <h2>Pagos y ajustes</h2>
            <ul className="centro-lista">
              {delMes
                .filter((m) => m.tipo !== 'cargo')
                .slice()
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((m) => (
                  <li className="centro-item" key={m.id}>
                    <div>
                      {NOMBRE[m.tipo] ?? m.tipo}
                      <small>
                        {dia(m.fecha)}
                        {m.detalle ? ` · ${m.detalle}` : ''}
                      </small>
                    </div>
                    <div>
                      {signo(m.tipo) < 0 ? '−' : ''}
                      {pesos(m.importe)}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* El cierre, con la cuenta hecha: horas, consumos, pagos y saldo. */}
        <div className="centro-panel">
          <table className="centro-cierre">
            <tbody>
              <tr>
                <td>Horas usadas · {horasDelMes} h</td>
                <td className="centro-num">{pesos(cargos)}</td>
              </tr>
              <tr>
                <td>Pagos registrados</td>
                <td className="centro-num">− {pesos(pagos)}</td>
              </tr>
              <tr className="centro-total">
                <td>{saldo < 0 ? 'A favor' : saldo === 0 ? 'Saldo del mes' : 'Saldo a pagar'}</td>
                <td className="centro-num">{pesos(Math.abs(saldo))}</td>
              </tr>
              {total !== saldo && (
                <tr>
                  <td>Saldo de todos los meses</td>
                  <td className="centro-num">{pesos(total)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {saldo > 0 && (
            <table className="centro-cierre centro-plazos">
              <tbody>
                <tr>
                  <td>Pagando hasta el 10</td>
                  <td className="centro-num">{pesos(saldo)}</td>
                </tr>
                <tr>
                  <td>Del 11 al 20, con 15 %</td>
                  <td className="centro-num">{pesos(Math.round(saldo * 1.15))}</td>
                </tr>
                <tr>
                  <td>Del 21 en adelante, con 25 %</td>
                  <td className="centro-num">{pesos(Math.round(saldo * 1.25))}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="centro-panel">
          <h2>Cómo se paga</h2>
          <p className="centro-nota" style={{ marginTop: 0 }}>
            Efectivo o transferencia. Pedile los datos bancarios a Lorena o a
            Lucila y avisales cuando transferís, así lo registran acá.
          </p>
        </div>
      </main>
    </>
  );
}
