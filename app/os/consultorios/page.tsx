import Link from 'next/link';
import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';
import {
  cierresEntre,
  gastos as leerGastos,
  contratos as leerContratos,
  diasDe,
  diasHabilesDelMes,
  escalaVigente,
  escalas,
  hora,
  hoyISO,
  listarEspacios,
  listarInquilinos,
  lunesDe,
  aperturas as leerAperturas,
  mesCorrido,
  movimientos as leerMovimientos,
  periodoDe,
  reservasEntre,
  sumarDias,
} from '@/lib/consultorios';
import Calendario from './Calendario';
import Inquilinos from './Inquilinos';
import Espacios from './Espacios';
import Finanzas from './Finanzas';

export const dynamic = 'force-dynamic';

/**
 * El hub de los consultorios: el calendario, quién alquila y las salas.
 *
 * Tres pestañas y no seis. Las cuentas vivían aparte de los inquilinos y los
 * precios aparte de los espacios, y en los dos casos era la misma lista dos
 * veces: para reclamarle a alguien había que buscar su teléfono en la otra
 * pantalla, y para saber por qué una sala cuesta más había que cruzar de
 * memoria qué incluía. Los cierres tampoco son una pestaña: se ponen sobre el
 * calendario, que es donde se ve la fecha.
 *
 * **El calendario tiene dos vistas.** La semana, hora por hora y con las cuatro
 * salas juntas, para trabajar; el mes, para ver cómo viene. La vista y la fecha
 * viajan en la dirección, así una pantalla se comparte y se recarga igual.
 */

const PESTANAS = [
  { clave: 'semana', texto: 'Calendario' },
  { clave: 'inquilinos', texto: 'Inquilinos' },
  { clave: 'finanzas', texto: 'Finanzas' },
  { clave: 'espacios', texto: 'Espacios' },
];

const QUE_HACE: Record<string, string> = {
  semana:
    'Arrastrá sobre las horas libres para reservar o cerrar la sala. Tocá lo reservado para liberarlo, y lo cerrado para volver a abrirlo.',
  inquilinos:
    'Quién alquila, con su legajo y su cuenta del mes. Sin matrícula vigente no se puede reservar, como dice el documento de convivencia.',
  finanzas:
    'Lo que entra, lo que sale y qué queda. Abajo, contra qué decidir: quién sostiene el mes y qué horas están vacías.',
};

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

function mesLargo(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

export default async function Consultorios({
  searchParams,
}: {
  searchParams: { ver?: string; semana?: string; mes?: string; periodo?: string; sala?: string };
}) {
  const yo = await quienSoy();
  const cuentas = await cuentasDeLaBarra();
  const pedida = searchParams.ver ?? '';
  const ver = PESTANAS.some((p) => p.clave === pedida) ? pedida : 'semana';

  const hoy = hoyISO();
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const UUID = /^[0-9a-f-]{36}$/i;

  /*
   * El mes es la vista de entrada y la semana es a la que se baja.
   *
   * Era al revés hasta el 8/9/2026, y la primera pregunta al abrir el
   * calendario no es qué pasa el jueves: es cómo viene el mes. La semana manda
   * solo cuando viene su fecha en la dirección.
   *
   * **Con una sala elegida no hay vista semanal.** Una sola columna por día es
   * un calendario de bolsillo: lo que se mira de un consultorio es el mes
   * entero, y para el detalle de un día están las cinco salas juntas.
   */
  const salaPedida = UUID.test(searchParams.sala ?? '') ? (searchParams.sala as string) : null;
  const enSemana = !salaPedida && FECHA.test(searchParams.semana ?? '');
  const enMes = !enSemana;
  const mes = FECHA.test(searchParams.mes ?? '') ? periodoDe(searchParams.mes as string) : periodoDe(hoy);
  const lunes = lunesDe(enSemana ? (searchParams.semana as string) : hoy);

  const diasMes = diasHabilesDelMes(mes);
  const dias = enMes ? diasMes : diasDe(lunes);
  const desde = dias[0];
  const hasta = dias[dias.length - 1];

  const periodo = FECHA.test(searchParams.periodo ?? '')
    ? (searchParams.periodo as string)
    : periodoDe(hoy);

  // Finanzas mira el mes elegido y no la semana: la ocupación se promedia sobre
  // el mes, que es el tramo en el que se decide una promoción.
  const delMes = diasHabilesDelMes(periodo).filter((f) => f.slice(0, 7) === periodo.slice(0, 7));

  const [
    espacios,
    aperturas,
    cierres,
    reservas,
    inquilinos,
    contratos,
    escala,
    movimientos,
    todasLasEscalas,
    gastos,
  ] = await Promise.all([
    listarEspacios(),
    leerAperturas(),
    ver === 'semana'
      ? cierresEntre(desde, hasta)
      : ver === 'finanzas'
        ? cierresEntre(delMes[0], delMes[delMes.length - 1])
        : Promise.resolve([]),
    ver === 'semana'
      ? reservasEntre(desde, hasta)
      : ver === 'finanzas'
        ? reservasEntre(delMes[0], delMes[delMes.length - 1])
        : Promise.resolve([]),
    listarInquilinos(),
    leerContratos(),
    ver === 'semana' ? escalaVigente(hoy) : Promise.resolve({ desde: null, tarifas: [] }),
    ver === 'inquilinos' || ver === 'finanzas' ? leerMovimientos() : Promise.resolve([]),
    ver === 'espacios' ? escalas() : Promise.resolve([]),
    ver === 'finanzas' ? leerGastos() : Promise.resolve([]),
  ]);

  const activos = espacios.filter((e) => e.activo);
  // Lo que se dibuja: todas las salas, o la elegida. La ocupación de arriba
  // sigue el mismo recorte, así el número y la grilla hablan de lo mismo.
  const enPantalla = salaPedida ? activos.filter((e) => e.id === salaPedida) : activos;
  const sala = salaPedida ? activos.find((e) => e.id === salaPedida) : null;

  // La ocupación de lo que se está mirando, sala por sala: horas reservadas
  // sobre horas abiertas. Es el número del negocio y va antes que la grilla.
  // Se cuenta sobre los días que se muestran, que en el mes son semanas
  // enteras: contar solo los del mes daba un número que no cerraba con la
  // grilla de al lado.
  const ocupacion = enPantalla.map((e) => {
    const suyas = aperturas.filter((a) => a.espacio_id === e.id);
    const abiertas = dias.reduce((n, f) => {
      const d = (new Date(`${f}T12:00:00-03:00`).getDay() + 6) % 7;
      const a = suyas.find((x) => x.dia_semana === d);
      return n + (a ? hora(a.hasta_hora) - hora(a.desde_hora) : 0);
    }, 0);
    const vendidas = reservas
      .filter((r) => r.espacio_id === e.id)
      .reduce((n, r) => n + (hora(r.hasta_hora) - hora(r.desde_hora)), 0);
    return {
      espacio: e,
      abiertas,
      vendidas,
      pct: abiertas > 0 ? Math.round((vendidas / abiertas) * 100) : 0,
    };
  });

  // La sala elegida viaja en todas las direcciones del calendario: cambiar de
  // mes no puede devolver a la vista de las cinco.
  const conSala = salaPedida ? `&sala=${salaPedida}` : '';
  const dirSemana = (s: string) => `/os/consultorios?ver=semana&semana=${s}`;
  const dirMes = (m: string) => `/os/consultorios?ver=semana&mes=${m}${conSala}`;
  const dirSala = (id: string | null) =>
    `/os/consultorios?ver=semana&mes=${mes}${id ? `&sala=${id}` : ''}`;

  return (
    <Shell
      titulo="Consultorios"
      identidad={yo.nombre}
      cuentas={cuentas}
      nota={ver === 'semana' ? (enMes ? mesLargo(mes) : `Semana del ${dia(lunes)}`) : undefined}
      ancho
    >
      {/* Sin bajada: cada pestaña ya explica lo suyo debajo de la fila de
          pestañas, y arriba había un párrafo que se leía una vez y después
          ocupaba cuatro renglones para siempre. */}
      <div className="os-encabezado">
        <h1>Centro Integral Santiago</h1>
      </div>

      <nav className="os-pestanas">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/os/consultorios?ver=${p.clave}`}
            className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
            aria-current={ver === p.clave ? 'page' : undefined}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {QUE_HACE[ver] && <p className="os-form-nota os-configuracion-que">{QUE_HACE[ver]}</p>}

      {enPantalla.length === 0 && (
        <div className="os-panel">
          <p className="os-vacio">Todavía no hay salas cargadas.</p>
        </div>
      )}

      {ver === 'semana' && enPantalla.length > 0 && (
        <>
          {/* En un renglón cada una: cinco tarjetas altas se llevaban un cuarto
              de la pantalla antes de que empezara el calendario. */}
          <div className="os-cifras os-cifras-chicas">
            {ocupacion.map((o) => (
              <div className="os-cifra" key={o.espacio.id}>
                <div className="os-cifra-rotulo">{o.espacio.nombre}</div>
                <div className="os-cifra-valor">{o.pct}%</div>
                <div className="os-cifra-pie">
                  {o.vendidas}/{o.abiertas} h
                </div>
              </div>
            ))}
          </div>

          <div className="os-panel os-panel-calendario">
            <div className="os-agenda-top">
              <div className="os-agenda-semana">
                {enMes ? mesLargo(mes) : `Semana del ${dia(desde)} al ${dia(hasta)}`}
                {sala && <span className="os-panel-cuenta"> · {sala.nombre}</span>}
              </div>
              {/* Qué tramo se mira y en qué vista: dos preguntas de la misma
                  familia, en dos grupos de la misma forma. */}
              <div className="os-agenda-mover">
                {/* Qué sala se mira. "Todas" es la grilla de siempre; elegir
                    una la muestra sola, mes por mes. Los números y no los
                    nombres: seis nombres completos no entran en la fila, y la
                    pregunta ("cómo viene el 2") ya se hace con el número. */}
                <span className="os-nav-grupo">
                  <Link className={salaPedida ? undefined : 'activa'} href={dirSala(null)}>
                    Todas
                  </Link>
                  {activos.map((e) => (
                    <Link
                      key={e.id}
                      className={salaPedida === e.id ? 'activa' : undefined}
                      href={dirSala(e.id)}
                      title={e.nombre}
                    >
                      {e.nombre.replace('Consultorio ', '')}
                    </Link>
                  ))}
                </span>
                {/* Con una sala elegida no se ofrece la semana: una columna por
                    día no es un calendario, es una lista. */}
                {!salaPedida && (
                  <span className="os-nav-grupo os-nav-grupo-parejo">
                    <Link
                      className={enMes ? undefined : 'activa'}
                      href={dirSemana(enMes ? diasMes[0] : lunes)}
                    >
                      Semana
                    </Link>
                    <Link className={enMes ? 'activa' : undefined} href={dirMes(enMes ? mes : periodoDe(lunes))}>
                      Mes
                    </Link>
                  </span>
                )}
                <span className="os-nav-grupo">
                  <Link
                    className="os-nav-flecha"
                    aria-label={enMes ? 'Mes anterior' : 'Semana anterior'}
                    href={enMes ? dirMes(mesCorrido(mes, -1)) : dirSemana(sumarDias(lunes, -7))}
                  >
                    ‹
                  </Link>
                  <Link href={enMes ? dirMes(periodoDe(hoy)) : dirSemana(hoy)}>
                    {enMes ? 'Este mes' : 'Esta semana'}
                  </Link>
                  <Link
                    className="os-nav-flecha"
                    aria-label={enMes ? 'Mes siguiente' : 'Semana siguiente'}
                    href={enMes ? dirMes(mesCorrido(mes, 1)) : dirSemana(sumarDias(lunes, 7))}
                  >
                    ›
                  </Link>
                </span>
              </div>
            </div>

            <Calendario
              espacios={enPantalla}
              aperturas={aperturas}
              cierres={cierres}
              reservas={reservas}
              inquilinos={inquilinos}
              tarifas={escala.tarifas}
              contratos={contratos}
              vista={enMes ? 'mes' : 'semana'}
              ancla={dias}
              hoy={hoy}
            />
          </div>
        </>
      )}

      {ver === 'inquilinos' && (
        <Inquilinos
          inquilinos={inquilinos}
          contratos={contratos}
          movimientos={movimientos}
          periodo={periodo}
          hoy={hoy}
        />
      )}

      {ver === 'finanzas' && (
        <Finanzas
          espacios={activos}
          aperturas={aperturas}
          cierres={cierres}
          reservas={reservas}
          inquilinos={inquilinos}
          movimientos={movimientos}
          gastos={gastos}
          dias={delMes}
          periodo={periodo}
          hoy={hoy}
        />
      )}

      {ver === 'espacios' && (
        <Espacios espacios={espacios} aperturas={aperturas} escalas={todasLasEscalas} hoy={hoy} />
      )}
    </Shell>
  );
}
