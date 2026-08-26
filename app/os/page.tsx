import Link from 'next/link';
import Shell from './Shell';
import Saludo from './Saludo';
import Pendientes from './Pendientes';
import { panorama } from '@/lib/os';
import { equipo, quienSoy } from '@/lib/identidad';
import { pendientes } from '@/lib/pendientes';
import { ABIERTOS, formatoFecha, formatoImporte } from '@/lib/cotizaciones';
import { diaDe, haceCuanto, hoy as diaDeHoy, soloHora } from '@/lib/hora';
import { listarEvaluaciones } from '@/lib/psicotecnicos';
import { COLOR_ETAPA } from '@/lib/psicotecnicos-tipos';

export const dynamic = 'force-dynamic';

/**
 * La home del OS: lo que hay que seguir y lo que hay que hacer.
 *
 * Se dejó solo eso. Los clientes, los atajos y las cifras de arriba estaban
 * pero no pedían nada: eran una foto del sistema, no una lista de trabajo, y
 * empujaban hacia abajo lo único que sí hay que mirar todos los días.
 *
 * Arriba, lo del equipo: los temas de la próxima reunión y las tareas de las
 * tres. Abajo, lo que está en curso: psicotécnicos y cotizaciones abiertas.
 */

const COLOR_COTIZACION: Record<string, string> = {
  Lead: 'os-gris',
  Enviada: 'os-ambar',
  Aprobada: 'os-verde',
  Perdida: 'os-rojo',
};

export default async function Inicio() {
  const [yo, miembros, { enCurso, cotizaciones }, lista, evaluaciones] = await Promise.all([
    quienSoy(),
    equipo(),
    panorama(),
    pendientes(),
    listarEvaluaciones(),
  ]);

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
   * Las entrevistas de hoy, con la hora y el enlace a su hoja.
   *
   * Es lo primero que se mira al abrir el OS y era lo único que había que ir a
   * buscar a otra pantalla. Aparece solo si hay alguna: un panel que casi
   * siempre dice "ninguna" empuja hacia abajo lo que sí hay que hacer.
   */
  const dia = diaDeHoy();
  const deHoy = evaluaciones.filas
    .filter((e) => diaDe(e.fechaEntrevista) === dia)
    .filter((e) =>
      yo.alcance === 'todo' ? true : yo.evaluadora ? (e.evaluadora ?? '').includes(yo.evaluadora) : false
    )
    .sort((a, b) => (a.fechaEntrevista ?? '').localeCompare(b.fechaEntrevista ?? ''));

  return (
    <Shell titulo="Inicio" identidad={yo.nombre} cuentas={{ '/os/cotizaciones': abiertas.length }}>
      <div className="os-encabezado">
        <Saludo nombre={yo.nombre} />
      </div>

      {deHoy.length > 0 && (
        <section className="os-panel os-hoy">
          <div className="os-panel-top">
            <h2>Entrevistas de hoy</h2>
            <Link href="/os/psicotecnicos/entrevistas" className="os-enlace">
              Ver las entrevistas
            </Link>
          </div>
          {deHoy.map((e) => (
            <Link className="os-fila os-fila-enlace" key={e.id} href={`/os/psicotecnicos/ficha/${e.id}?ver=entrevista`}>
              <span className="os-hoy-hora">{soloHora(e.fechaEntrevista) ?? 'sin hora'}</span>
              <div className="os-fila-cuerpo">
                <div className="os-fila-titulo">{e.nombre}</div>
                <div className="os-fila-detalle">
                  {e.empresa} · {e.puesto}
                  {yo.alcance === 'todo' && e.evaluadora ? ` · ${e.evaluadora}` : ''}
                </div>
              </div>
              <div className="os-fila-lado">
                <span className={`os-sello-estado ${COLOR_ETAPA[e.etapa] ?? 'os-gris'}`}>
                  {e.modalidad ?? e.etapa}
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      <div className="os-tablero">
        <Pendientes
          titulo="Para la próxima reunión"
          nota={lista.reunion.length > 0 ? `${lista.reunion.length} temas` : undefined}
          filas={lista.reunion}
          equipo={nombres}
          yo={yo.nombre}
          paraReunion
          otraLista="pendientes"
        />

        <Pendientes
          titulo="Pendientes del equipo"
          nota={sinHacer > 0 ? `${sinHacer} sin hacer` : 'todo al día'}
          filas={lista.tareas}
          equipo={nombres}
          yo={yo.nombre}
          paraReunion={false}
          otraLista="la reunión"
        />

        <section className="os-panel">
          <div className="os-panel-top">
            <h2>Psicotécnicos en curso</h2>
            <Link href="/os/psicotecnicos/sin-asignar" className="os-enlace">
              Ver todos
            </Link>
          </div>
          {mios.length === 0 ? (
            <p className="os-vacio">
              {yo.alcance === 'todo'
                ? 'No hay evaluaciones abiertas.'
                : 'No tenés evaluaciones abiertas.'}
            </p>
          ) : (
            mios.map((p) => (
              <div className="os-fila" key={`${p.cliente}-${p.nombre}`}>
                <div className="os-fila-cuerpo">
                  <div className="os-fila-titulo">{p.nombre}</div>
                  <div className="os-fila-detalle">
                    {p.cliente} · {p.puesto}
                    {p.evaluadora ? ` · ${p.evaluadora}` : ''}
                  </div>
                </div>
                <div className="os-fila-lado">
                  <span className={`os-sello-estado ${COLOR_ETAPA[p.etapa] ?? 'os-gris'}`}>
                    {p.etapa}
                  </span>
                  <div style={{ marginTop: 3, color: 'var(--os-suave)' }}>
                    {p.dias === null ? 'sin entrevista' : haceCuanto(p.dias)}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="os-panel">
          <div className="os-panel-top">
            <h2>Cotizaciones abiertas</h2>
            <Link href="/os/cotizaciones" className="os-enlace">
              Ver todas
            </Link>
          </div>
          {abiertas.length === 0 ? (
            <p className="os-vacio">No hay cotizaciones esperando respuesta.</p>
          ) : (
            abiertas.map((c) => (
              <div className="os-fila" key={c.id}>
                <div className="os-fila-cuerpo">
                  <div className="os-fila-titulo">{c.cliente}</div>
                  <div className="os-fila-detalle">
                    {c.concepto} · {formatoImporte(c.importe)}
                  </div>
                </div>
                <div className="os-fila-lado">
                  <span className={`os-sello-estado ${COLOR_COTIZACION[c.estado] ?? 'os-gris'}`}>
                    {c.estado}
                  </span>
                  <div style={{ marginTop: 3, color: 'var(--os-suave)' }}>
                    {formatoFecha(c.fecha)}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </Shell>
  );
}
