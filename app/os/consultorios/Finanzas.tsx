'use client';

/**
 * Qué deja el Centro y de dónde sale.
 *
 * Cuatro preguntas, en este orden: **cuánto quedó** este mes, **cómo viene el
 * año**, **quién sostiene el negocio** y **qué horas están vacías**. Las dos
 * primeras son la cuenta; las dos últimas son con qué decidir: a quién cuidar y
 * qué banda poner en promoción.
 *
 * **La ocupación se mide contra lo abierto y no contra el día entero.** Una
 * sala que abre de 8 a 21 tiene trece horas para vender; contra veinticuatro
 * ninguna sala llegaría al 60 % y no se podrían comparar entre sí.
 *
 * **Los costos se cargan acá y no en Costos.** Esa pantalla es la del estudio
 * (psicotécnicos y servicios de Campos HR); el Centro es otro negocio, con otro
 * dueño de la cuenta y otro resultado.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  type Corte,
  DIAS_CORTOS,
  hora,
  medirOcupacion,
  mesLargo,
  periodoDe,
  RUBROS,
  type Apertura,
  type Cierre,
  type Espacio,
  type Gasto,
  type Inquilino,
  type Movimiento,
  type Reserva,
} from '@/lib/consultorios-calculo';
import { mandar, pesos } from './acciones';

/** Cuántos meses se miran hacia atrás en el gráfico del año. */
const MESES = 12;

const RUBRO: Record<Gasto['rubro'], string> = {
  alquiler: 'Alquiler',
  expensas: 'Expensas',
  servicios: 'Servicios',
  limpieza: 'Limpieza',
  mantenimiento: 'Mantenimiento',
  insumos: 'Insumos',
  sueldos: 'Sueldos',
  otros: 'Otros',
};

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

function mesCorrido(periodo: string, n: number): string {
  const d = new Date(`${periodo}T12:00:00-03:00`);
  d.setMonth(d.getMonth() + n);
  return periodoDe(d.toISOString().slice(0, 10));
}

function mesCorto(periodo: string): string {
  const t = new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(
    new Date(`${periodo}T12:00:00-03:00`)
  );
  return t.replace('.', '').replace(/^./, (c) => c.toUpperCase());
}

/**
 * El importe abreviado: en una columna de sesenta píxeles no entra entero.
 *
 * Millones con dos decimales y miles redondeados: "1480k" hay que traducirlo
 * mentalmente a un millón y medio, y con doce meses de cifras así el gráfico se
 * lee más lento que la tabla.
 */
function corto(n: number): string {
  if (n === 0) return '';
  const a = Math.abs(n);
  const s =
    a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M` : a >= 1000 ? `${Math.round(a / 1000)}k` : String(Math.round(a));
  return n < 0 ? `−${s}` : s;
}

/**
 * El área de ocupación: el fondo es lo abierto y el verde lo vendido.
 *
 * Vive una vez y se dibuja dos, por sala y por día: son la misma lectura sobre
 * dos cortes, y copiada se habría separado en la primera corrección. Los puntos
 * van fuera del SVG porque el lienzo se estira sin conservar la proporción y un
 * círculo dibujado adentro saldría ovalado.
 */
function Area({ cortes, techo }: { cortes: Corte[]; techo: string }) {
  const x = (k: number) => ((k + 0.5) / cortes.length) * 100;
  const camino =
    `M 0 ${100 - (cortes[0]?.pct ?? 0)} ` +
    cortes.map((c, k) => `L ${x(k)} ${100 - c.pct}`).join(' ') +
    ` L 100 ${100 - (cortes[cortes.length - 1]?.pct ?? 0)}`;

  return (
    <>
      <div className="os-salas-lienzo">
        <span className="os-salas-techo">
          <b>{techo}</b>
        </span>

        <svg className="os-salas-area" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="os-salas-verde" d={`${camino} L 100 100 L 0 100 Z`} />
          <path className="os-salas-linea" fill="none" vectorEffect="non-scaling-stroke" d={camino} />
        </svg>

        {cortes.map((c, k) => (
          <i
            className="os-salas-punto"
            key={c.clave}
            style={{ left: `${x(k)}%`, bottom: `${c.pct}%` }}
            title={`${c.rotulo}: ${c.vendidas} de ${c.abiertas} horas`}
          />
        ))}
      </div>

      {/* Las horas van debajo y no encima del punto: arriba tapaban la línea
          justo donde hay que leerla. */}
      <div className="os-salas-rotulos">
        {cortes.map((c) => (
          <span key={c.clave}>
            {c.rotulo}
            <b>{c.pct} %</b>
            <small>
              {c.vendidas} de {c.abiertas} h
            </small>
          </span>
        ))}
      </div>
    </>
  );
}

export default function Finanzas({
  espacios,
  aperturas,
  cierres,
  reservas,
  inquilinos,
  movimientos,
  gastos,
  dias,
  periodo,
  hoy,
}: {
  espacios: Espacio[];
  aperturas: Apertura[];
  cierres: Cierre[];
  /** Las del mes que se está mirando: de ahí sale la ocupación. */
  reservas: Reserva[];
  inquilinos: Inquilino[];
  /** Todos, de todos los meses: el gráfico del año los necesita. */
  movimientos: Movimiento[];
  gastos: Gasto[];
  /** Los días del mes que se está mirando. */
  dias: string[];
  periodo: string;
  hoy: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // ------------------------------------------------------------- el mes
  const facturado = movimientos
    .filter((m) => m.periodo === periodo && m.tipo === 'cargo')
    .reduce((n, m) => n + m.importe, 0);
  const cobrado = movimientos
    .filter((m) => m.periodo === periodo && m.tipo === 'pago')
    .reduce((n, m) => n + m.importe, 0);
  const delMes = gastos.filter((g) => g.periodo === periodo);
  const costos = delMes.reduce((n, g) => n + g.importe, 0);
  const resultado = facturado - costos;

  // ------------------------------------------------------------- el año
  const historia = Array.from({ length: MESES }, (_, k) => {
    const p = mesCorrido(periodoDe(hoy), k - (MESES - 1));
    const ingresos = movimientos
      .filter((m) => m.periodo === p && m.tipo === 'cargo')
      .reduce((n, m) => n + m.importe, 0);
    const salidas = gastos.filter((g) => g.periodo === p).reduce((n, g) => n + g.importe, 0);
    return { periodo: p, etiqueta: mesCorto(p), ingresos, salidas, resultado: ingresos - salidas };
  });
  // El techo es el mes más grande de los dos lados: en un mes en pérdida la
  // barra mide lo que se gastó, no lo que entró.
  const techo = Math.max(...historia.map((m) => Math.max(m.ingresos, m.salidas)), 1);
  const alto = (n: number) => (n === 0 ? '0' : `${Math.max((n / techo) * 100, 2)}%`);

  // ------------------------------------------------------ quién sostiene
  const ranking = inquilinos
    .map((i) => {
      const suyos = movimientos.filter(
        (m) => m.inquilino_id === i.id && m.periodo === periodo && m.tipo === 'cargo'
      );
      const suyas = reservas.filter((r) => r.inquilino_id === i.id);
      const horas = suyas.reduce((n, r) => n + (hora(r.hasta_hora) - hora(r.desde_hora)), 0);
      // Cuántos días distintos vino: de ahí sale cuántas horas hace cada vez
      // que viene, que no es lo mismo que repartir el mes entre todos los días
      // hábiles. Alguien que viene dos veces por semana ocho horas no hace una
      // hora y media por día.
      const dias = new Set(suyas.map((r) => r.fecha)).size;
      return { i, importe: suyos.reduce((n, m) => n + m.importe, 0), horas, dias };
    })
    .filter((f) => f.importe > 0 || f.horas > 0)
    .sort((a, b) => b.importe - a.importe);
  const totalRanking = ranking.reduce((n, f) => n + f.importe, 0);

  // -------------------------------------------------------- qué está vacío
  const ocupacion = medirOcupacion(espacios, dias, aperturas, reservas, cierres);
  const frias = [...ocupacion.porHora].sort((a, b) => a.pct - b.pct).slice(0, 3);
  const calientes = [...ocupacion.porHora].sort((a, b) => b.pct - a.pct).slice(0, 3);

  /**
   * El color de una celda del mapa, como tono de la rueda.
   *
   * Verde donde sobra lugar, amarillo en el medio, rojo donde está lleno: es la
   * lectura de semáforo, y acá lo que se busca es dónde hay para vender. Rojo
   * no es "mal": es la banda que no hay que tocar.
   *
   * De 140 a 48 en la primera mitad y de 48 a 5 en la segunda, así el amarillo
   * cae en el 50 % y no antes; con una interpolación pareja entre verde y rojo,
   * el medio salía verde oliva y las tres zonas dejaban de distinguirse.
   */
  const demanda = (pct: number) =>
    pct <= 50 ? 140 - (pct / 50) * 92 : 48 - ((pct - 50) / 50) * 43;

  const dir = (p: string) => `/os/consultorios?ver=finanzas&periodo=${p}`;

  async function altaGasto(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setGuardando(true);
    const r = await mandar({
      accion: 'gasto-alta',
      fecha: String(d.get('fecha') ?? ''),
      periodo,
      concepto: String(d.get('concepto') ?? ''),
      rubro: String(d.get('rubro') ?? ''),
      importe: Number(d.get('importe')),
      fijo: d.get('fijo') === 'on',
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo cargar el gasto.');
    setError(null);
    setCargando(false);
    (ev.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function borrarGasto(id: string) {
    const r = await mandar({ accion: 'gasto-baja', id });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo borrar.');
    setError(null);
    router.refresh();
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      {/* Chicas: con el tamaño normal las tarjetas se llevaban un tercio de
          la pantalla antes de empezar el panel, que es lo que se viene a
          mirar. */}
      <div className="os-cifras os-cifras-finas">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Facturado</div>
          <div className="os-cifra-valor">{pesos(facturado)}</div>
          <div className="os-cifra-pie">{mesLargo(periodo)}</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Cobrado</div>
          <div className="os-cifra-valor">{pesos(cobrado)}</div>
          <div className="os-cifra-pie">
            {facturado > 0 ? `${Math.round((cobrado / facturado) * 100)} % de lo facturado` : '—'}
          </div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Costos</div>
          <div className="os-cifra-valor">{pesos(costos)}</div>
          <div className="os-cifra-pie">{delMes.length} cargados</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Resultado</div>
          <div className={`os-cifra-valor${resultado < 0 ? ' os-cifra-roja' : ''}`}>
            {pesos(resultado)}
          </div>
          <div className="os-cifra-pie">
            {facturado > 0 ? `margen ${Math.round((resultado / facturado) * 100)} %` : 'sin ingresos'}
          </div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Ocupación</div>
          <div className="os-cifra-valor">{ocupacion.total.pct} %</div>
          <div className="os-cifra-pie">
            {ocupacion.total.vendidas} de {ocupacion.total.abiertas} h
          </div>
        </div>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>El año</h2>
          <span className="os-columna-monto">Ingresos y costos, mes a mes</span>
        </div>

        <div className="os-mixto">
          <div className="os-mixto-lienzo os-mixto-alto">
            <div className="os-mixto-barras os-mixto-doce">
              {historia.map((m) => (
                <div className="os-mixto-col" key={m.periodo}>
                  {/* Lo facturado, escrito sobre la barra: los tramos dicen de
                      qué está hecha, y sin el total arriba había que sumar los
                      dos de memoria para saber cuánto entró ese mes. */}
                  {(m.ingresos > 0 || m.salidas > 0) && (
                    <span
                      className="os-mixto-total"
                      style={{ bottom: alto(Math.max(m.ingresos, m.salidas)) }}
                    >
                      {corto(Math.max(m.ingresos, m.salidas))}
                    </span>
                  )}
                  {/* Apilada: la barra entera es lo facturado, partido en lo
                      que se fue en costos y lo que quedó. Al lado, las dos
                      barras decían lo mismo dos veces y el resultado había que
                      restarlo con la vista.

                      En un mes en pérdida la barra mide el gasto: el amarillo
                      llega hasta lo que entró y arriba queda en rojo lo que no
                      se cubrió. */}
                  {(m.ingresos > 0 || m.salidas > 0) && (
                    <div className="os-mes-pila">
                      {m.resultado >= 0 ? (
                        <div
                          className="os-mes-lleno resultado"
                          style={{ height: alto(m.resultado) }}
                          data-detalle={`Quedó ${pesos(m.resultado)}`}
                        />
                      ) : (
                        <div
                          className="os-mes-lleno perdida"
                          style={{ height: alto(-m.resultado) }}
                          data-detalle={`Faltaron ${pesos(-m.resultado)}`}
                        />
                      )}
                      <div
                        className="os-mes-lleno gasto"
                        style={{ height: alto(m.resultado >= 0 ? m.salidas : m.ingresos) }}
                        data-detalle={`Costos ${pesos(m.salidas)}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="os-mixto-rotulos os-mixto-doce">
            {historia.map((m) => (
              <span key={m.periodo}>
                {m.etiqueta}
                <b className={m.resultado < 0 ? 'os-cifra-roja' : undefined}>{corto(m.resultado)}</b>
              </span>
            ))}
          </div>

          <p className="os-referencias">
            <span className="os-referencia">
              <i className="os-referencia-color gasto" /> Costos
            </span>
            <span className="os-referencia">
              <i className="os-referencia-color resultado" /> Lo que quedó
            </span>
            <span className="os-referencia">
              La barra entera es lo facturado. Pasando por encima de cada tramo dice cuánto es.
            </span>
          </p>
        </div>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            Costos de {mesLargo(periodo)}
            <span className="os-panel-cuenta"> · {pesos(costos)}</span>
          </h2>
          <div className="os-agenda-mover os-incluye-baja">
            <button
              className="os-boton os-boton-firme"
              type="button"
              onClick={() => setCargando((v) => !v)}
            >
              {cargando ? 'Cancelar' : 'Cargar un costo'}
            </button>
            <span className="os-nav-grupo">
              <Link className="os-nav-flecha" aria-label="Mes anterior" href={dir(mesCorrido(periodo, -1))}>
                ‹
              </Link>
              <Link href={dir(periodoDe(hoy))}>Este mes</Link>
              <Link className="os-nav-flecha" aria-label="Mes siguiente" href={dir(mesCorrido(periodo, 1))}>
                ›
              </Link>
            </span>
          </div>
        </div>

        {cargando && (
          <form
            className="os-incluye-alta os-panel-pie os-panel-pie-claro"
            autoComplete="off"
            onSubmit={altaGasto}
          >
            <label className="os-etiqueta-campo">
              Fecha
              <input className="os-campo os-campo-suave" type="date" name="fecha" defaultValue={hoy} required />
            </label>
            <label className="os-etiqueta-campo">
              Rubro
              <select className="os-campo os-campo-suave os-campo-medio" name="rubro" defaultValue="servicios">
                {RUBROS.map((r) => (
                  <option key={r} value={r}>
                    {RUBRO[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="os-etiqueta-campo">
              Concepto
              <input
                className="os-campo os-campo-suave"
                name="concepto"
                autoComplete="off"
                placeholder="Luz de agosto"
                required
              />
            </label>
            <label className="os-etiqueta-campo">
              Importe
              <input
                className="os-campo os-campo-suave os-campo-corto"
                name="importe"
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </label>
            <label className="os-tilde-fila">
              <input type="checkbox" name="fijo" />
              Todos los meses
            </label>
            <button className="os-boton os-boton-firme" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Cargar'}
            </button>
          </form>
        )}

        {delMes.length === 0 ? (
          <p className="os-vacio">
            Este mes no tiene costos cargados. Sin ellos, lo facturado se lee como si fuera lo que
            queda.
          </p>
        ) : (
          // Del mismo alto que el ranking de abajo: son dos listas de un dato
          // por renglón en el mismo panel, y con dos altos distintos se leían
          // como dos cosas de distinta importancia.
          <table className="os-tabla os-tabla-fija os-tabla-compacta">
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '38%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Rubro</th>
                <th>Concepto</th>
                <th className="os-tabla-num">Importe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {delMes.map((g) => (
                <tr key={g.id}>
                  <td>{dia(g.fecha)}</td>
                  <td>{RUBRO[g.rubro]}</td>
                  <td>
                    {g.concepto}
                    {g.fijo && <span className="os-panel-cuenta"> · todos los meses</span>}
                  </td>
                  <td className="os-tabla-num">{pesos(g.importe)}</td>
                  <td className="os-tabla-accion">
                    {porBorrar === g.id ? (
                      <>
                        <button
                          className="os-boton os-boton-fila os-boton-peligro"
                          type="button"
                          onClick={() => {
                            setPorBorrar(null);
                            borrarGasto(g.id);
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
                        onClick={() => setPorBorrar(g.id)}
                      >
                        Borrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td />
                <td />
                <td className="os-tabla-num">
                  <strong>{pesos(costos)}</strong>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Quién sostiene el mes</h2>
          <span className="os-columna-monto">{ranking.length} con movimiento</span>
        </div>
        {ranking.length === 0 ? (
          <p className="os-vacio">Este mes todavía no hay reservas.</p>
        ) : (
          // Compacta: son trece renglones de un dato cada uno, y con el alto
          // normal la lista se llevaba media pantalla para decir quién factura
          // cuánto.
          // Los números centrados en su columna, no contra el borde: son seis
          // columnas angostas y cada valor quedaba lejos del título que lo
          // encabeza.
          <table className="os-tabla os-tabla-fija os-tabla-compacta os-tabla-centrada">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Inquilino</th>
                {/* "Horas" a secas, al lado de "por semana" y "por visita", no
                    dice de qué tramo habla: las tres son horas. */}
                <th className="os-tabla-num">Por mes</th>
                <th className="os-tabla-num" title="Las horas del mes divididas por cuatro semanas">
                  Por semana
                </th>
                <th
                  className="os-tabla-num"
                  title="Cuántas horas usa la sala cada día que viene: las horas del mes divididas por los días distintos en que reservó"
                >
                  Por visita
                </th>
                <th className="os-tabla-num">Facturado</th>
                <th className="os-tabla-num">Del total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((f) => {
                const parte = totalRanking > 0 ? (f.importe / totalRanking) * 100 : 0;
                return (
                  <tr key={f.i.id}>
                    <td>
                      <Link className="os-enlace-nombre" href={`/os/consultorios/inquilino/${f.i.id}`}>
                        {f.i.nombre}
                      </Link>
                    </td>
                    <td className="os-tabla-num">{f.horas} h</td>
                    {/* El mes en cuatro semanas, que es la cuenta con la que se
                        habla de un alquiler: "tiene seis horas por semana". */}
                    <td className="os-tabla-num">{(f.horas / 4).toFixed(1)} h</td>
                    <td className="os-tabla-num">
                      {f.dias > 0 ? `${(f.horas / f.dias).toFixed(1)} h` : '—'}
                    </td>
                    <td className="os-tabla-num">{pesos(f.importe)}</td>
                    <td className="os-tabla-num">{Math.round(parte)} %</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Mapa de calor</h2>
          <span className="os-columna-monto">
            {ocupacion.total.pct} % de {ocupacion.total.abiertas} horas abiertas
          </span>
        </div>

        {/* El mapa contesta la pregunta sin que nadie la formule: la fila más
            clara es la banda que hay que poner en promoción. */}
        {/* Los días en filas y las horas en columnas, y no al revés: con
            trece horas apiladas el cuadro salía más alto que ancho y había que
            recorrerlo de arriba abajo. Apaisado se ve la semana entera de un
            golpe, que es como se piensa "los martes a la mañana". */}
        <div className="os-mapa">
          <table className="os-tabla os-mapa-tabla">
            <thead>
              <tr>
                <th />
                {ocupacion.horas.map((h) => (
                  <th key={h}>{String(h).padStart(2, '0')}</th>
                ))}
                <th className="os-tabla-num">Media</th>
              </tr>
            </thead>
            <tbody>
              {DIAS_CORTOS.map((rotulo, d) => {
                const fila = ocupacion.porDia.find((c) => c.clave === String(d));
                return (
                  <tr key={d}>
                    <th>{rotulo}</th>
                    {ocupacion.horas.map((h) => {
                      const c = ocupacion.celdas[`${d}|${h}`];
                      return (
                        <td
                          key={h}
                          className={`os-mapa-celda${c ? ' os-mapa-llena' : ''}`}
                          style={
                            c
                              ? ({ '--demanda': Math.round(demanda(c.pct)) } as React.CSSProperties)
                              : undefined
                          }
                          title={
                            c
                              ? `${rotulo} ${String(h).padStart(2, '0')}:00 · ${c.vendidas} de ${c.abiertas} salas`
                              : 'Cerrado'
                          }
                        >
                          {c ? `${c.pct}%` : '—'}
                        </td>
                      );
                    })}
                    <td className="os-tabla-num">{fila?.pct ?? 0}%</td>
                  </tr>
                );
              })}
              <tr className="os-mapa-pie">
                <th>Media</th>
                {/* Centradas como las de arriba y no con `os-tabla-num`, que
                    las pega a la derecha: la media de una hora quedaba corrida
                    respecto de su columna y de su rótulo. */}
                {ocupacion.horas.map((h) => {
                  const c = ocupacion.porHora.find((x) => x.clave === String(h));
                  return (
                    <td key={h} className="os-mapa-celda">
                      {c?.pct ?? 0}%
                    </td>
                  );
                })}
                <td className="os-tabla-num">{ocupacion.total.pct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="os-referencias os-mapa-escala">
          <span className="os-referencia">
            <i className="os-referencia-color" style={{ background: 'hsl(140 62% 82%)' }} /> Vacío
          </span>
          <span className="os-referencia">
            <i className="os-referencia-color" style={{ background: 'hsl(48 72% 78%)' }} /> A medias
          </span>
          <span className="os-referencia">
            <i className="os-referencia-color" style={{ background: 'hsl(5 68% 84%)' }} /> Lleno
          </span>
          <span className="os-referencia">
            El rojo es la banda que se vende sola; el verde, la que hay para vender.
          </span>
        </p>

        {/* Las dos listas y el gráfico de salas en la misma fila: son tres
            lecturas de lo mismo (qué hora, qué sala) y una debajo de otra
            obligaban a desplazarse para comparar. */}
        <div className="os-analisis">
          <section>
            <h3>Las bandas calientes</h3>
            <ul className="os-lista-datos">
              {calientes.map((c) => (
                <li key={c.clave}>
                  <span>{c.rotulo}</span>
                  <strong>{c.pct} %</strong>
                </li>
              ))}
            </ul>
            <p className="os-panel-nota">
              Acá no conviene descuento: se vende sola y bajar el precio es
              regalar lo que ya se cobra.
            </p>
          </section>
          <section>
            <h3>Las bandas frías</h3>
            <ul className="os-lista-datos">
              {frias.map((c) => (
                <li key={c.clave}>
                  <span>{c.rotulo}</span>
                  <strong>{c.pct} %</strong>
                </li>
              ))}
            </ul>
            <p className="os-panel-nota">
              {frias[0]
                ? `Cada hora de ${frias[0].rotulo} que se venda es margen entero: la sala está abierta igual.`
                : 'Sin datos todavía.'}
            </p>
          </section>

          {/* En columnas contra el techo de horas abiertas, y no en barras
              horizontales: la pregunta no es qué porcentaje hizo cada sala sino
              cuánto le falta para llenarse, y eso se ve cuando las cuatro se
              miden contra la misma línea. */}
          {/* El mismo dibujo sobre dos cortes: por sala dice cuál llenar, por
              día dice cuándo. El rojo es lo abierto y el verde lo vendido, así
              lo que se mira es el hueco que queda hasta el techo. */}
          <section className="os-salas">
            <h3>% de ocupación por sala</h3>
            <Area
              cortes={ocupacion.porSala}
              techo={`${Math.max(...ocupacion.porSala.map((c) => c.abiertas), 0)} h abiertas`}
            />
          </section>

          <section className="os-salas">
            <h3>% de ocupación por día</h3>
            <Area
              cortes={ocupacion.porDia}
              techo={`${Math.max(...ocupacion.porDia.map((c) => c.abiertas), 0)} h abiertas`}
            />
          </section>
        </div>
      </div>
    </>
  );
}
