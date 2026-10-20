import Link from 'next/link';
import './sin-solicitante.css';
import Shell from '../../Shell';
import { select } from '@/lib/supabase';
import { contactosDelGrupo } from '@/lib/contactos';
import { NOMBRE_DEMO } from '@/lib/portal-demo';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '../datos';
import Solicitante, { type ContactoOpcion } from '../ficha/[id]/Solicitante';

export const dynamic = 'force-dynamic';

type Fila = {
  id: string;
  puesto: string;
  fecha_pedido: string | null;
  empresa_id: string;
  empresas: { nombre: string } | null;
  evaluaciones: {
    id: string;
    ciudad: string | null;
    personas: { nombre: string } | null;
    evaluadoras: { nombre: string } | null;
  }[];
};

/** Las dos evaluadoras van en este orden; cualquier otra, después. */
const ORDEN = ['Lorena Campos', 'Lucila Campos'];

function fechaCorta(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '';
}

/**
 * Las evaluaciones que no dicen quién del cliente las pidió.
 *
 * Sin ese dato el correo de los noventa días no tiene a quién salir, y casi
 * todo lo cargado antes del 3/10/2026 está así. Es una pantalla para ponerse
 * al día de una sentada: cada evaluadora ve las suyas, empresa por empresa, y
 * elige el nombre en el mismo desplegable de la ficha. Elegido, la fila sale
 * de la lista.
 *
 * Una pestaña por evaluadora: cada una completa lo suyo. Quien ve solo lo
 * suyo no ve la pestaña de la otra.
 *
 * Cuenta como faltante la evaluación sin solicitante propio en un pedido que
 * tampoco lo tiene: si el pedido lo tiene, vale el del pedido.
 */
export default async function SinSolicitante(props: {
  searchParams?: Promise<{ ver?: string }>;
}) {
  const ver = (await props.searchParams)?.ver;
  const [yo, cuentas, pedidos] = await Promise.all([
    quienSoy(),
    cuentasDeLaBarra(),
    select<Fila>(
      'pedidos',
      'select=id,puesto,fecha_pedido,empresa_id,empresas(nombre),' +
        'evaluaciones(id,ciudad,personas(nombre),evaluadoras(nombre))' +
        '&solicitante_id=is.null&evaluaciones.solicitante_id=is.null&order=fecha_pedido.desc'
    ),
  ]);

  const filas = pedidos
    .filter((p) => p.empresas?.nombre !== NOMBRE_DEMO)
    .flatMap((p) =>
      p.evaluaciones.map((e) => ({
        id: e.id,
        empresaId: p.empresa_id,
        empresa: p.empresas?.nombre ?? 'Sin empresa',
        pedido: e.ciudad ? `${p.puesto} (${e.ciudad})` : p.puesto,
        fecha: p.fecha_pedido,
        candidato: e.personas?.nombre ?? 'Sin nombre',
        evaluadora: e.evaluadoras?.nombre ?? 'Sin evaluadora',
      }))
    );

  // Los contactos de cada empresa con su grupo, una vez por empresa.
  const empresas = [...new Set(filas.map((f) => f.empresaId))];
  const contactos = new Map<string, ContactoOpcion[]>(
    await Promise.all(
      empresas.map(
        async (id) =>
          [
            id,
            (await contactosDelGrupo(id)).map((c) => ({ id: c.id, nombre: c.nombre, cargo: c.cargo })),
          ] as const
      )
    )
  );

  // Quien ve solo lo suyo ve solo su pestaña.
  const soloDe = yo.alcance !== 'todo' && yo.evaluadora ? yo.evaluadora : null;
  const pestanas = [
    ...ORDEN,
    ...[...new Set(filas.map((f) => f.evaluadora))].filter((n) => !ORDEN.includes(n)).sort(),
  ]
    .filter((n) => soloDe === null || n === soloDe)
    .map((n) => ({
      nombre: n,
      clave: n.split(' ')[0].toLowerCase(),
      cuenta: filas.filter((f) => f.evaluadora === n).length,
    }))
    .filter((p) => ORDEN.includes(p.nombre) || p.cuenta > 0);
  // Arranca en la propia; si no, en la primera que tenga algo.
  const activa =
    pestanas.find((p) => p.clave === ver) ??
    pestanas.find((p) => p.nombre === yo.evaluadora) ??
    pestanas.find((p) => p.cuenta > 0) ??
    pestanas[0];
  const evaluadoras = activa ? [activa.nombre] : [];
  const total = activa?.cuenta ?? 0;

  return (
    <Shell
      titulo="Sin solicitante"
      identidad={yo.nombre}
      nota={`${total} sin solicitante`}
      cuentas={cuentas}
    >
      <div className="os-encabezado">
        <h1>Evaluaciones sin solicitante</h1>
      </div>
      {pestanas.length > 1 && (
        <nav className="os-pestanas">
          {pestanas.map((p) => (
            <Link
              key={p.clave}
              href={`/os/psicotecnicos/sin-solicitante?ver=${p.clave}`}
              className={`os-pestana${p === activa ? ' activa' : ''}`}
              aria-current={p === activa ? 'page' : undefined}
            >
              {p.nombre.split(' ')[0]}
              <span className="os-pestana-cuenta">{p.cuenta}</span>
            </Link>
          ))}
        </nav>
      )}

      <p className="os-ss-ayuda">
        Elegí quién del cliente pidió cada evaluación. Sin ese dato, el correo de los 90 días no
        tiene a quién llegar. Se guarda al elegir, y la fila sale de la lista.
      </p>

      {total === 0 && <p className="os-vacio">No queda ninguna evaluación sin solicitante.</p>}

      {evaluadoras.map((ev) => {
        const suyas = filas.filter((f) => f.evaluadora === ev);
        const porEmpresa = [...new Set(suyas.map((f) => f.empresa))].sort(
          (a, b) =>
            suyas.filter((f) => f.empresa === b).length - suyas.filter((f) => f.empresa === a).length ||
            a.localeCompare(b, 'es')
        );
        return (
          <section key={ev} className="os-sin-solicitante">
            {porEmpresa.map((emp) => {
              const deEsta = suyas.filter((f) => f.empresa === emp);
              const opciones = contactos.get(deEsta[0].empresaId) ?? [];
              return (
                <div key={emp} className="os-sin-solicitante-empresa">
                  <h3>
                    {emp} <span className="os-pestana-cuenta">{deEsta.length}</span>
                  </h3>
                  {opciones.length === 0 && (
                    <p className="os-ss-ayuda">
                      Esta empresa no tiene contactos cargados: sumalos en su ficha de Clientes.
                    </p>
                  )}
                  <div className="os-tabla-marco">
                    <table className="os-tabla">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Pedido</th>
                          <th>Candidato</th>
                          <th>Solicitó</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deEsta.map((f) => (
                          <tr key={f.id}>
                            <td data-campo="Fecha" className="os-tabla-flojo">
                              {fechaCorta(f.fecha)}
                            </td>
                            <td data-campo="Pedido" className="os-tabla-recorta">
                              {f.pedido}
                            </td>
                            <td data-campo="Candidato" className="os-tabla-nombre">
                              <Link className="os-fila-nombre" href={`/os/psicotecnicos/ficha/${f.id}`}>
                                {f.candidato}
                              </Link>
                            </td>
                            <td data-campo="Solicitó">
                              <Solicitante id={f.id} valor={null} delPedido={null} contactos={opciones} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </Shell>
  );
}
