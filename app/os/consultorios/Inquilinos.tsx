'use client';

/**
 * Quién alquila, en una lista: cuánto tiene contratado y cómo viene su cuenta.
 *
 * **Es una lista y no una lista con una ficha adentro.** Hasta el 8/9/2026
 * tocar una fila abría un panel debajo con los datos de esa persona, su cuenta
 * y el cobro: para mirar a alguien había que perder de vista a los demás, y la
 * dirección no decía a quién se estaba mirando, así que no se podía compartir
 * ni volver. Cada persona tiene ahora su pantalla, en
 * `inquilino/[id]`, y de acá se llega con el botón de su fila.
 *
 * **Sin legajo no se reserva**, como pide el documento de convivencia:
 * matrícula profesional vigente y DNI antes de empezar a usar el Centro. La
 * lista lo marca en la fila, así se ve de un vistazo a quién hay que pedirle
 * papeles en vez de descubrirlo cuando ya está trabajando.
 *
 * **Se puede cargar a alguien sin correo.** Hay gente que alquila y nunca va a
 * entrar al sistema: se le reserva desde el calendario y se le lleva la cuenta
 * igual. El correo es el usuario con el que entra, así que se pide el día que
 * se le da acceso.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  horasSemanalesTotales,
  mesLargo,
  periodoDe,
  recargoDelDia,
  saldoDe,
  type Contrato,
  type Inquilino,
  type Movimiento,
} from '@/lib/consultorios-calculo';
import { mandar, pesos } from './acciones';

export default function Inquilinos({
  inquilinos,
  contratos,
  movimientos,
  periodo,
  hoy,
}: {
  inquilinos: Inquilino[];
  contratos: Contrato[];
  movimientos: Movimiento[];
  periodo: string;
  hoy: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const pct = recargoDelDia(hoy, periodo);
  const delMes = movimientos.filter((m) => m.periodo === periodo);

  const filas = inquilinos.map((i) => {
    const suyosDelMes = delMes.filter((m) => m.inquilino_id === i.id);
    return {
      i,
      horas: horasSemanalesTotales(contratos, i.id, hoy),
      cargos: suyosDelMes.filter((m) => m.tipo === 'cargo').reduce((n, m) => n + m.importe, 0),
      pagos: suyosDelMes.filter((m) => m.tipo === 'pago').reduce((n, m) => n + m.importe, 0),
      saldo: saldoDe(suyosDelMes),
      movimientos: suyosDelMes,
      // El saldo de todos los meses, que es lo que de verdad se debe.
      total: saldoDe(movimientos.filter((m) => m.inquilino_id === i.id)),
    };
  });

  const total = filas.reduce(
    (t, f) => ({
      cargos: t.cargos + f.cargos,
      pagos: t.pagos + f.pagos,
      saldo: t.saldo + f.saldo,
    }),
    { cargos: 0, pagos: 0, saldo: 0 }
  );

  const otroMes = (n: number) => {
    const d = new Date(`${periodo}T12:00:00-03:00`);
    d.setMonth(d.getMonth() + n);
    return periodoDe(d.toISOString().slice(0, 10));
  };
  const dir = (p: string) => `/os/consultorios?ver=inquilinos&periodo=${p}`;

  async function alta(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setGuardando(true);
    const r = await mandar({
      accion: 'inquilino-alta',
      nombre: String(d.get('nombre') ?? ''),
      correo: String(d.get('correo') ?? ''),
      telefono: String(d.get('telefono') ?? ''),
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo dar de alta.');
    setError(null);
    (ev.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      {/* Chicas, como las del calendario. */}
      <div className="os-cifras os-cifras-finas">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Facturado</div>
          <div className="os-cifra-valor">{pesos(total.cargos)}</div>
          <div className="os-cifra-pie">{mesLargo(periodo)}</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Cobrado</div>
          <div className="os-cifra-valor">{pesos(total.pagos)}</div>
          <div className="os-cifra-pie">{filas.filter((f) => f.pagos > 0).length} pagos</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Por cobrar</div>
          <div className="os-cifra-valor">{pesos(total.saldo)}</div>
          <div className="os-cifra-pie">
            {pct > 0 ? `Hoy corre ${pct}% de recargo` : 'Dentro del plazo, sin recargo'}
          </div>
        </div>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            {mesLargo(periodo)}{' '}
            <span className="os-panel-cuenta">
              · {filas.filter((f) => f.i.activo).length} activos
            </span>
          </h2>
          {/* El mismo control que el calendario: dos flechas y la vuelta al
              mes de hoy, en un solo grupo. Tres botones sueltos con el nombre
              escrito ocupaban el triple para decir lo mismo. */}
          <span className="os-nav-grupo os-incluye-baja">
            <Link
              className="os-nav-flecha"
              aria-label="Mes anterior"
              href={dir(otroMes(-1))}
            >
              ‹
            </Link>
            <Link href={dir(periodoDe(hoy))}>Este mes</Link>
            <Link
              className="os-nav-flecha"
              aria-label="Mes siguiente"
              href={dir(otroMes(1))}
            >
              ›
            </Link>
          </span>
        </div>

        {inquilinos.length === 0 && <p className="os-vacio">Todavía no hay nadie cargado.</p>}

        {inquilinos.length > 0 && (
          // Compacta, como las listas de Finanzas: son trece renglones de un
          // dato por columna, y con el alto normal la tabla se llevaba media
          // pantalla.
          <table className="os-tabla os-tabla-fija os-tabla-compacta">
            {/* Cinco columnas: quién, cuánto alquila y cómo viene su cuenta.
                El teléfono y el legajo se fueron a la ficha de cada uno el
                8/9/2026: acá se mira la lista para saber a quién hay que
                reclamarle, y el teléfono se necesita recién al abrirlo. */}
            <colgroup>
              <col style={{ width: '36%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="os-tabla-num">Horas</th>
                <th className="os-tabla-num">Reservas</th>
                <th className="os-tabla-num">Pagos</th>
                <th className="os-tabla-num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.i.id} className={f.i.activo ? undefined : 'os-cerrado-fila'}>
                  {/* El nombre es el enlace, no un botón al final de la fila:
                      es lo que se busca con la vista y lo que se toca. Y el
                      enlace y no la fila entera, para poder seleccionar un
                      importe sin que se abra la ficha. */}
                  <td>
                    <Link className="os-enlace-nombre" href={`/os/consultorios/inquilino/${f.i.id}`}>
                      {f.i.nombre}
                    </Link>
                  </td>
                  <td className="os-tabla-num">{f.horas > 0 ? `${f.horas} h` : '—'}</td>
                  <td className="os-tabla-num">{f.cargos > 0 ? pesos(f.cargos) : '—'}</td>
                  <td className="os-tabla-num">{f.pagos > 0 ? pesos(f.pagos) : '—'}</td>
                  <td className="os-tabla-num">{f.saldo === 0 ? 'Al día' : pesos(f.saldo)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td />
                <td className="os-tabla-num">{pesos(total.cargos)}</td>
                <td className="os-tabla-num">{pesos(total.pagos)}</td>
                <td className="os-tabla-num">{pesos(total.saldo)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Cargar a alguien</h2>
        </div>
        {/* Sin autocompletar: el navegador llenaba el nombre con un dato de
            otra pantalla, y acá un nombre equivocado termina en una cuenta
            corriente con plata adentro. */}
        <form className="os-incluye-alta" onSubmit={alta} autoComplete="off">
          <input className="os-campo os-campo-suave" name="nombre" autoComplete="off" placeholder="Nombre y apellido" required />
          <input className="os-campo os-campo-suave" name="telefono" autoComplete="off" placeholder="Teléfono" />
          <input
            className="os-campo os-campo-suave"
            name="correo"
            autoComplete="off"
            placeholder="Correo (solo si va a usar el sistema)"
          />
          <button className="os-boton" type="submit" disabled={guardando}>
            Agregar
          </button>
        </form>
      </div>
    </>
  );
}
