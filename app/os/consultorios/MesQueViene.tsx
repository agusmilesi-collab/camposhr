'use client';

/**
 * El mes que viene: qué contestó cada inquilino y qué se va a generar.
 *
 * El mes se abre solo el último día del anterior (`lib/apertura-mes.ts`), así
 * que esta pantalla no es un paso obligatorio: es donde se mira cómo viene y
 * se resuelve lo que el sistema no puede decidir, que es lo que alguien quiere
 * sumar. Lo que se deja lo marca el inquilino sobre sus horas y se aplica solo.
 *
 * El botón abre antes de tiempo, o completa un mes ya abierto después de sumar
 * una banda: abrir dos veces no duplica nada.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Choque, ResumenInquilino } from '@/lib/apertura-mes';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function dia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso));
}

function respuesta(i: ResumenInquilino): string {
  if (i.respuesta === 'no') return 'No sigue';
  if (i.respuesta === 'cambiar') {
    const partes = [
      i.horasQueDeja > 0 ? `deja ${i.horasQueDeja} h` : '',
      i.nota ? 'quiere sumar' : '',
    ].filter(Boolean);
    return partes.length ? `Cambia: ${partes.join(' y ')}` : 'Cambia';
  }
  if (i.respuesta === 'si') return 'Renueva';
  return 'Sin contestar: renueva';
}

export default function MesQueViene({
  mes,
  periodo,
  abierto,
  automatico,
  inquilinos,
  choques,
  reservas,
  importe,
}: {
  /** El mes escrito: "diciembre de 2026". */
  mes: string;
  periodo: string;
  abierto: { abierto_at: string; quien: string | null } | null;
  /** El día en que el sistema lo abre solo, si todavía no se abrió. */
  automatico: string;
  inquilinos: ResumenInquilino[];
  choques: Choque[];
  /** Lo que falta generar: con el mes abierto, lo que completaría el botón. */
  reservas: number;
  importe: number;
}) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cuenta = (r: ResumenInquilino['respuesta']) => inquilinos.filter((i) => i.respuesta === r).length;
  const porSumar = inquilinos.filter((i) => i.respuesta === 'cambiar' && i.nota);
  const sinBandas = inquilinos.filter((i) => i.respuesta !== 'no' && i.horasSemana === 0 && i.respuesta !== null);

  async function abrir() {
    setError(null);
    setHecho(null);
    setAbriendo(true);
    try {
      const res = await fetch('/api/os/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'mes-abrir', periodo }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? `No se pudo abrir (error ${res.status}).`);
        return;
      }
      setHecho(
        d.reservas === 0
          ? 'No faltaba nada: el mes ya estaba completo.'
          : `Listo: ${d.reservas} reservas por ${pesos(d.importe)}.`
      );
      router.refresh();
    } catch {
      setError('No se pudo abrir: se cortó la conexión.');
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <>
      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            {mes.charAt(0).toUpperCase() + mes.slice(1)}{' '}
            <span className="os-panel-cuenta">
              · {cuenta('si')} renuevan · {cuenta('cambiar')} cambian · {cuenta('no')} no siguen ·{' '}
              {cuenta(null)} sin contestar
            </span>
          </h2>
          {(!abierto || reservas > 0) && (
            <button type="button" className="os-boton os-boton-firme" onClick={abrir} disabled={abriendo}>
              {abriendo ? 'Abriendo…' : abierto ? 'Completar el mes' : 'Abrir ahora'}
            </button>
          )}
        </div>

        <p className="os-panel-nota">
          {abierto
            ? `Abierto el ${dia(abierto.abierto_at)}${abierto.quien ? ` por ${abierto.quien}` : ''}.` +
              (reservas > 0
                ? ` Faltan ${reservas} reservas por ${pesos(importe)}: son de bandas sumadas después.`
                : ' Está completo.')
            : `Se abre solo el ${dia(automatico)} a las 10 con ${reservas} reservas por ${pesos(importe)}. ` +
              'Quien no contestó sigue con sus horas. Si ya está todo resuelto, se puede abrir antes.'}
        </p>
        {hecho && <p className="os-panel-nota">{hecho}</p>}
        {error && <p className="os-panel-nota os-form-error">{error}</p>}
      </div>

      {(porSumar.length > 0 || choques.length > 0 || sinBandas.length > 0) && (
        <div className="os-panel">
          <div className="os-panel-top">
            <h2>Para resolver</h2>
          </div>
          <ul className="os-lista-avisos os-panel-nota" style={{ paddingLeft: 36 }}>
            {porSumar.map((i) => (
              <li key={i.id}>
                <b>{i.nombre}</b> quiere sumar: «{i.nota}». Cargale la banda desde{' '}
                <Link href={`/os/consultorios/inquilino/${i.id}`}>su ficha</Link>; si el mes ya está
                abierto, sus reservas se generan solas.
              </li>
            ))}
            {choques.map((c, n) => (
              <li key={n}>
                <b>{c.inquilino}</b> tiene banda el {dia(c.fecha)} de {c.desde.slice(0, 5)} a{' '}
                {c.hasta.slice(0, 5)} en {c.sala}, y esa hora ya la tiene reservada {c.con}. No se
                genera hasta que se resuelva.
              </li>
            ))}
            {sinBandas.map((i) => (
              <li key={i.id}>
                <b>{i.nombre}</b> contestó que sigue y no tiene horas fijas para ese mes.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="os-panel">
        <table className="os-tabla os-tabla-fija">
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Inquilino</th>
              <th>Respuesta</th>
              <th className="os-tabla-num">Por semana</th>
              <th className="os-tabla-num">Reservas</th>
              <th className="os-tabla-num">{abierto ? 'Falta generar' : 'A generar'}</th>
            </tr>
          </thead>
          <tbody>
            {inquilinos.map((i) => (
              <tr key={i.id}>
                <td data-campo="Inquilino">
                  <Link href={`/os/consultorios/inquilino/${i.id}`}>{i.nombre}</Link>
                </td>
                <td data-campo="Respuesta" title={i.nota ?? undefined}>
                  {respuesta(i)}
                  {i.feriados.length > 0 && ` · usa el feriado ${i.feriados.map(dia).join(' y ')}`}
                </td>
                <td data-campo="Por semana" className="os-tabla-num">
                  {i.horasSemana !== i.horasSemanaAntes ? `${i.horasSemanaAntes} → ` : ''}
                  {i.horasSemana} h
                </td>
                <td data-campo="Reservas" className="os-tabla-num">
                  {i.reservas}
                </td>
                <td data-campo="Importe" className="os-tabla-num">
                  {pesos(i.importe)}
                </td>
              </tr>
            ))}
            <tr>
              <td data-campo="Inquilino">
                <b>Total</b>
              </td>
              <td />
              <td />
              <td data-campo="Reservas" className="os-tabla-num">
                <b>{reservas}</b>
              </td>
              <td data-campo="Importe" className="os-tabla-num">
                <b>{pesos(importe)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
