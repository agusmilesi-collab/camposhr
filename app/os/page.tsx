import Link from 'next/link';
import Shell from './Shell';
import Saludo from './Saludo';
import Pendientes from './Pendientes';
import Tablero from './Tablero';
import { listarCotizaciones } from '@/lib/cotizaciones';
import { equipo, quienSoy } from '@/lib/identidad';
import { pendientes } from '@/lib/pendientes';
import { ABIERTOS, DIAS_SEGUIMIENTO } from '@/lib/cotizaciones';
import { diasEntre } from '@/lib/comercial-tipos';
import { diaDe, hoy as diaDeHoy } from '@/lib/hora';
import { listarEvaluaciones } from '@/lib/psicotecnicos';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

/** Las etapas de una evaluación que todavía pide trabajo. */
const ABIERTAS = new Set(['Sin asignar', 'Por citar', 'Por entrevistar', 'Por analizar']);


export const dynamic = 'force-dynamic';

/**
 * La home del OS: lo que hay que seguir y lo que hay que hacer.
 *
 * Se dejó solo eso. Los clientes, los atajos y las cifras de arriba estaban
 * pero no pedían nada: eran una foto del sistema, no una lista de trabajo, y
 * empujaban hacia abajo lo único que sí hay que mirar todos los días.
 *
 * Arriba el tablero de psicotécnicos, con las entrevistas del día adentro de
 * su columna Hoy. Debajo, bajo el rótulo Campos HR, lo del estudio: las tareas
 * de las tres, que se llevan dos tercios porque cada una tiene dueño, fecha y
 * estado, y al lado los temas de la próxima reunión, que son solo un texto.
 *
 * El panel "Entrevistas de hoy" salió el 27/8/2026: sus filas son las tarjetas
 * azules del tablero, así que decía lo mismo un renglón más arriba.
 *
 * Las cotizaciones abiertas salieron el 27/8/2026. Era una lista de consulta
 * entre dos listas de trabajo, y lo que hay que hacer con una cotización se
 * hace en su pantalla; el número de las que esperan respuesta sigue en la barra
 * lateral, que es donde avisa sin ocupar media home.
 */

export default async function Inicio() {
  const [yo, miembros, cotizaciones, lista, evaluaciones] = await Promise.all([
    quienSoy(),
    equipo(),
    listarCotizaciones(),
    pendientes(),
    listarEvaluaciones(),
  ]);

  /**
   * Lo que está abierto, leído de la base del sistema.
   *
   * Salía de Airtable, que dejó de escribirse con la migración del 25/8/2026:
   * el panel mostraba la etapa que tenía cada evaluación ese día, así que una
   * entrevista tomada ayer seguía figurando como si nada hubiera pasado.
   *
   * Van enteras al tablero, que las ordena por prioridad y las reparte en sus
   * columnas. Lo entregado no entra: un informe que se subió al portal ya está
   * listo, y se mira en Entregados.
   */
  const enCurso = evaluaciones.filas.filter((e) => ABIERTAS.has(e.etapa));

  const abiertas = cotizaciones.filter((c) => ABIERTOS.includes(c.estado));
  const nombres = miembros.map((m) => m.nombre);
  const sinHacer = lista.tareas.filter((t) => !t.hecha).length;

  /**
   * Lo que está en curso, de quien mira.
   *
   * Esta home es la cola propia, así que muestra lo que tiene el nombre de
   * quien mira y nada más. Quien tiene alcance `todo` sigue viendo el conjunto,
   * que es la misma regla del resto del OS (`lib/identidad.ts`).
   *
   * Lo que no tiene evaluadora queda afuera a propósito: no es de nadie
   * todavía, y ya avisa el círculo azul de "Sin asignar" en la barra.
   */
  const mios =
    yo.alcance === 'todo'
      ? enCurso
      : enCurso.filter((p) => (yo.evaluadora ? (p.evaluadora ?? '').includes(yo.evaluadora) : false));

  /**
   * Quiénes tienen entrevista hoy, para que el tablero las ponga en Hoy.
   *
   * Solo las que todavía no se tomaron: tomada, la evaluación pasa a Por
   * analizar y deja de ser una cita para volver a ser trabajo que se acomoda,
   * que es la diferencia que la tarjeta azul marca. Una que pasó de hora y
   * sigue sin tomarse se queda ahí, porque eso es justamente lo que hay que
   * resolver.
   *
   * El día lo decide el servidor: en el navegador depende del huso de quien
   * mira y la primera pintura no coincidiría con la que llega del servidor.
   */
  const dia = diaDeHoy();
  const sinTomar = (etapa: string) => etapa === 'Por citar' || etapa === 'Por entrevistar';
  const citasDeHoy = mios
    .filter((e) => diaDe(e.fechaEntrevista) === dia && sinTomar(e.etapa))
    .map((e) => e.id);

  /**
   * Las propuestas que hay que seguir, que entran solas a la columna Hoy.
   *
   * Una propuesta enviada y sin respuesta se enfría sin que nadie se entere, y
   * el embudo no avisa: hay que entrar a mirarlo. Se cuentan los días desde el
   * envío, o desde el último seguimiento cuando ya se hizo uno, y a los tres
   * aparece el aviso. Lo ven las tres, porque seguir una propuesta no es de
   * nadie en particular.
   */
  const seguimientos = cotizaciones
    .filter((c) => c.estado === 'Enviada')
    .map((c) => ({
      id: c.id,
      cliente: c.cliente,
      concepto: c.concepto,
      token: c.token,
      dias: diasEntre(c.seguimientoEl ?? c.fecha, dia),
    }))
    .filter((s) => s.dias >= DIAS_SEGUIMIENTO)
    .sort((a, b) => b.dias - a.dias);

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell titulo="Inicio" identidad={yo.nombre} cuentas={cuentas}>
      <div className="os-encabezado">
        <Saludo nombre={yo.nombre} />
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Psicotécnicos</h2>
          <Link href="/os/psicotecnicos/entrevistas" className="os-enlace">
            Ver el pipeline
          </Link>
        </div>
        {mios.length === 0 && seguimientos.length === 0 ? (
          <p className="os-vacio">
            {yo.alcance === 'todo'
              ? 'No hay evaluaciones abiertas.'
              : 'No tenés evaluaciones abiertas.'}
          </p>
        ) : (
          <Tablero
            filas={mios}
            citasDeHoy={citasDeHoy}
            conEvaluadora={yo.alcance === 'todo'}
            seguimientos={seguimientos}
          />
        )}
      </section>

      <h2 className="os-rotulo-seccion">Campos HR</h2>

      <div className="os-tablero os-tablero-equipo">
        <Pendientes
          titulo="Pendientes del equipo"
          nota={sinHacer > 0 ? `${sinHacer} sin hacer` : 'todo al día'}
          filas={lista.tareas}
          hoy={dia}
          equipo={nombres}
          yo={yo.nombre}
          paraReunion={false}
        />

        <Pendientes
          titulo="Para la próxima reunión"
          nota={
            lista.reunion.length > 0
              ? `${lista.reunion.length} ${lista.reunion.length === 1 ? 'tema' : 'temas'}`
              : undefined
          }
          filas={lista.reunion}
          hoy={dia}
          equipo={nombres}
          yo={yo.nombre}
          paraReunion
        />

      </div>
    </Shell>
  );
}
