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
  movimientos as leerMovimientos,
  periodoDe,
  recargoDelDia,
  reservasEntre,
  saldoDe,
  signo,
} from '@/lib/consultorios';
import Barra from '../Barra';
import { facturasDelCentro } from '@/lib/facturas-centro';
import { comprobantesDe } from '@/lib/comprobantes-pago';
import Comprobante from './Comprobante';
import Anteriores from './Anteriores';
import { CUENTA_DEL_CENTRO } from '@/lib/centro-pago';

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
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

const NOMBRE: Record<string, string> = {
  cargo: 'Reserva',
  pago: 'Pago',
  recargo: 'Recargo',
  credito: 'Crédito',
  ajuste: 'Ajuste',
};

/** Las horas de un cargo, leídas del principio de su detalle ("Consultorio 2,
 *  09:00 a 18:00"). Es lo que queda cuando la reserva ya no está. */
function horasDelDetalle(detalle: string | null): number {
  const m = /, (\d{2}):\d{2} a (\d{2}):\d{2}/.exec(detalle ?? '');
  return m ? Number(m[2]) - Number(m[1]) : 0;
}

export default async function Cuenta({ searchParams }: { searchParams: { ver?: string } }) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const hoy = hoyISO();
  /*
   * Tres pestañas, y la del medio aparece y desaparece:
   *
   *   Reservas mes en curso   lo que va usando este mes, que todavía no se paga.
   *   Mes a pagar             el mes que acaba de cerrar, con su factura, los
   *                           plazos, a dónde transferir y dónde dejar el
   *                           comprobante. Aparece el día 1 y se va cuando ese
   *                           mes queda pagado.
   *   Meses anteriores        para consultar y abrir los papeles.
   *
   * Cada mes se paga a mes vencido, del 1 al 10 del siguiente.
   */
  const mesActual = periodoDe(hoy);
  const mesAnterior = mesCorrido(mesActual, -1);

  const todos = await leerMovimientos();
  const mios = todos.filter((m) => m.inquilino_id === yo.id);
  const saldoAnterior = saldoDe(mios.filter((m) => m.periodo === mesAnterior));
  const hayQuePagar = saldoAnterior > 0;
  /** Lo que sale hoy pagar el mes anterior, con el recargo que corra. */
  const aPagarHoy = Math.round(saldoAnterior * (1 + recargoDelDia(hoy, mesAnterior) / 100));

  const vista: 'reservas' | 'pagar' | 'anteriores' =
    searchParams.ver === 'anteriores'
      ? 'anteriores'
      : searchParams.ver === 'pagar' && hayQuePagar
        ? 'pagar'
        : 'reservas';
  const enLista = vista === 'anteriores';
  /** El mes del que hablan los paneles: el que se paga, o el que corre. */
  const periodo = vista === 'pagar' ? mesAnterior : mesActual;

  const finDeMes = new Date(Number(periodo.slice(0, 4)), Number(periodo.slice(5, 7)), 0);
  const hasta = `${periodo.slice(0, 8)}${String(finDeMes.getDate()).padStart(2, '0')}`;

  const [reservas, espacios] = await Promise.all([reservasEntre(periodo, hasta), listarEspacios()]);
  const delMes = mios.filter((m) => m.periodo === periodo);
  const saldo = saldoDe(delMes);
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

  // Las facturas emitidas a esta persona, para descargar. Salen del mismo
  // comprobante que ve el equipo: un solo papel para los dos lados.
  const todasLasFacturas = await facturasDelCentro(yo.id);
  /** Las anuladas no se ofrecen: son un papel que ya no vale. El período de
   *  una factura es el primer día de su mes. */
  const facturasDe = (mes: string) =>
    todasLasFacturas.filter(
      (f) => f.estado !== 'anulada' && (f.periodo ?? '').slice(0, 7) === mes.slice(0, 7),
    );
  const facturas = facturasDe(periodo);
  const numeroDe = (f: (typeof todasLasFacturas)[number]) =>
    f.numero === null
      ? 'Factura C'
      : `Factura C ${String(f.puntoVenta ?? 0).padStart(5, '0')}-${String(f.numero).padStart(8, '0')}`;

  /**
   * Los meses anteriores, del más nuevo al más viejo, con lo que se baja de
   * cada uno. Sale de los movimientos: un mes sin cargos ni pagos no fue un mes
   * en el Centro y no aparece.
   */
  const anteriores = [...new Set(mios.map((m) => m.periodo).filter((x): x is string => Boolean(x)))]
    .filter((mes) => mes < mesActual)
    .sort((a, b) => b.localeCompare(a))
    .map((mes) => {
      const suyos = mios.filter((m) => m.periodo === mes);
      const cargosDelMes = suyos.filter((m) => m.tipo === 'cargo');
      return {
        mes,
        horas: cargosDelMes.reduce((n, m) => n + horasDelDetalle(m.detalle), 0),
        importe: cargosDelMes.reduce((n, m) => n + m.importe, 0),
        cargos: cargosDelMes.slice().sort((x, y) => x.fecha.localeCompare(y.fecha)),
        saldo: saldoDe(suyos),
        facturas: facturasDe(mes),
        pagos: suyos
          .filter((m) => m.tipo === 'pago')
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      };
    });

  // Los comprobantes que ya subió para este mes: se listan debajo de la caja,
  // así no sube dos veces el mismo por no saber si llegó.
  const cuando = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const subidos = (await comprobantesDe(yo.id))
    .filter((c) => c.periodo === periodo)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      cuando: cuando.format(new Date(c.created_at)),
    }));

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/cuenta" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Tu cuenta</h1>
        <p className="centro-bajada">
          Cada mes se paga del 1 al 10 del mes siguiente. Del 11 al 20 lleva 15% de recargo y del 21
          en adelante, 25%.
        </p>

        <nav className="centro-pestanas">
          {/* Enlaces comunes y no `Link`: el navegador guarda medio minuto la
              pantalla que ya visitó, y acá eso es ver una pestaña de antes de
              que se registrara o se borrara un pago. Cada toque vuelve a
              preguntarle al servidor. */}
          <a className={vista === 'reservas' ? 'activa' : undefined} href="/centro/cuenta">
            Reservas mes en curso
          </a>
          {hayQuePagar && (
            <a
              className={vista === 'pagar' ? 'activa' : undefined}
              href="/centro/cuenta?ver=pagar"
            >
              Mes a pagar
            </a>
          )}
          <a
            className={vista === 'anteriores' ? 'activa' : undefined}
            href="/centro/cuenta?ver=anteriores"
          >
            Meses anteriores
          </a>
        </nav>

        {enLista ? (
          <div className="centro-panel">
            {anteriores.length === 0 ? (
              <p className="centro-nota" style={{ marginTop: 0 }}>
                Todavía no hay meses anteriores.
              </p>
            ) : (
              <Anteriores
                meses={anteriores.map((a) => ({
                  mes: a.mes,
                  nombre: mesLargo(a.mes),
                  horas: a.horas,
                  importe: pesos(a.importe),
                  estado:
                    a.saldo > 0
                      ? { texto: `Debe ${pesos(a.saldo)}`, debe: true }
                      : a.saldo < 0
                        ? { texto: `A favor ${pesos(-a.saldo)}`, debe: false }
                        : { texto: 'Pagado', debe: false },
                  facturas: a.facturas.map((f) => ({
                    id: f.id,
                    numero: numeroDe(f),
                  })),
                  pagos: a.pagos.length,
                  horasDelMes: a.cargos.map((m) => {
                    const partido = /^(.*?), (\d{2}:\d{2}) a (\d{2}:\d{2})/.exec(m.detalle ?? '');
                    const horas = horasDelDetalle(m.detalle);
                    return {
                      id: m.id,
                      dia: `${DIAS_CORTOS[diaSemanaDe(m.fecha)]} ${dia(m.fecha)}`,
                      sala: partido?.[1] ?? '—',
                      horario: partido ? `${partido[2]} a ${partido[3]}` : '—',
                      horas: horas > 0 ? `${horas} h` : '—',
                      importe: pesos(m.importe),
                    };
                  }),
                }))}
              />
            )}
          </div>
        ) : (
          <>
            {/* Lo que debe y la factura de eso, lado a lado: son el mismo dato
                dicho dos veces, el número y su papel. */}
            <div
              className={
                (vista === 'pagar' && facturas.length > 0) || (vista === 'reservas' && hayQuePagar)
                  ? 'centro-dos'
                  : undefined
              }
            >
              <div className="centro-panel">
                <h2>{mesLargo(periodo)}</h2>
                {vista === 'pagar' ? (
                  <>
                    <div className="centro-saldo">{pesos(Math.round(saldo * (1 + pct / 100)))}</div>
                    <p className="centro-nota">
                      {pct > 0
                        ? `Son ${pesos(saldo)} más ${pct}% de recargo por pagar después del 10.`
                        : 'Hasta el 10 se paga sin recargo.'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="centro-saldo">{pesos(cargos)}</div>
                    <p className="centro-nota">
                      Es lo reservado hasta hoy. Se paga del 1 al 10 de{' '}
                      {mesLargo(mesCorrido(mesActual, 1)).split(' ')[0]}.
                    </p>
                  </>
                )}
              </div>

              {/* El mes que hay que pagar, al lado del que corre: el que entra
                  a mirar sus reservas se entera acá de que tiene un pago
                  pendiente, sin tener que abrir la otra pestaña para saberlo. */}
              {vista === 'reservas' && hayQuePagar && (
                <div className="centro-panel">
                  <h2>{mesLargo(mesAnterior)}, para pagar</h2>
                  <div className="centro-saldo">{pesos(aPagarHoy)}</div>
                  <p className="centro-nota">
                    {aPagarHoy > saldoAnterior
                      ? 'Ya lleva recargo por pagar después del 10. '
                      : 'Hasta el 10 se paga sin recargo. '}
                    <a href="/centro/cuenta?ver=pagar">Ver el mes a pagar</a>
                  </p>
                </div>
              )}

              {vista === 'pagar' && facturas.length > 0 && (
                <div className="centro-panel">
                  <h2>{facturas.length === 1 ? 'La factura del mes' : 'Las facturas del mes'}</h2>
                  <div className="centro-facturas">
                    {facturas.map((f) => (
                      <a
                        className="centro-factura"
                        key={f.id}
                        href={`/api/centro/factura-pdf/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>
                          <b>{numeroDe(f)}</b>
                          <span className="centro-nota">
                            {' '}
                            · emitida el {dia(f.fecha)} · abrir el PDF
                          </span>
                        </span>
                        <span className="centro-factura-monto">
                          {f.importe === null ? '—' : pesos(f.importe)}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* El mismo detalle que las propietarias bajan en PDF, leído en
            pantalla: qué día, en qué sala, de qué hora a qué hora, cuántas
            horas y a cuánto. Un renglón que dice "$ 13.220" y nada más obliga a
            preguntar de dónde salió. */}
            <div className="centro-panel">
              <h2>Las horas del mes</h2>

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
                  Las horas marcadas como liberadas se soltaron fuera del plazo de siete días: la
                  sala volvió al calendario para venderse de nuevo, y la hora se cobra igual, como
                  dice el documento de convivencia.
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
                        <div className="centro-item-fin">
                          {/* El recibo existe porque el pago está registrado: lo
                              carga el equipo cuando ve la plata. Es el mismo
                              botón que en los meses anteriores. */}
                          {m.tipo === 'pago' && (
                            <a
                              className="centro-bajar centro-abrir"
                              href={`/api/centro/recibo/${m.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Recibo
                            </a>
                          )}
                          <span>
                            {signo(m.tipo) < 0 ? '−' : ''}
                            {pesos(m.importe)}
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* El cierre, con la cuenta hecha: horas, consumos, pagos y saldo. Solo
            en el mes a pagar: en el que corre todavía no hay nada que cerrar, y
            el total ya está al pie de la tabla de horas. */}
            {vista === 'pagar' && (
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
                      <td>
                        {saldo < 0 ? 'A favor' : saldo === 0 ? 'Saldo del mes' : 'Saldo a pagar'}
                      </td>
                      <td className="centro-num">{pesos(Math.abs(saldo))}</td>
                    </tr>
                  </tbody>
                </table>

                {vista === 'pagar' && saldo > 0 && (
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
            )}

            {vista === 'pagar' && (
              <div className="centro-panel">
                <h2>Cómo se paga</h2>
                <p className="centro-nota" style={{ marginTop: 0 }}>
                  Efectivo o transferencia. Cuando transferís, dejá el comprobante acá abajo: Lorena
                  o Lucila registran el pago y te queda el recibo acá.
                </p>
                <dl className="centro-cbu">
                  <div>
                    <dt>Titular</dt>
                    <dd>{CUENTA_DEL_CENTRO.titular}</dd>
                  </div>
                  <div>
                    <dt>Banco</dt>
                    <dd>{CUENTA_DEL_CENTRO.banco}</dd>
                  </div>
                  <div>
                    <dt>CBU</dt>
                    <dd>{CUENTA_DEL_CENTRO.cbu}</dd>
                  </div>
                  <div>
                    <dt>Alias</dt>
                    <dd>{CUENTA_DEL_CENTRO.alias}</dd>
                  </div>
                  <div>
                    <dt>CUIT</dt>
                    <dd>{CUENTA_DEL_CENTRO.cuit}</dd>
                  </div>
                </dl>
                {CUENTA_DEL_CENTRO.dePrueba && (
                  <p className="centro-nota centro-soltar-error">
                    Estos datos son de prueba: todavía no transfieras a esta cuenta.
                  </p>
                )}
                <Comprobante periodo={periodo} mes={mesLargo(periodo)} subidos={subidos} />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
