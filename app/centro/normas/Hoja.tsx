import { NORMAS_VERSION } from '@/lib/centro-acceso';
import { escalaVigente, listarEspacios } from '@/lib/consultorios';
import { hoyISO } from '@/lib/consultorios-calculo';
import { NORMAS, NORMAS_FECHA } from './contenido';

/** Cómo se nombra cada tramo en la tabla: "4 a 7", y el último "16 o más". */
function nombreDelTramo(desde: number, siguiente: number | undefined): string {
  return siguiente === undefined ? `${desde} o más` : desde === siguiente - 1 ? `${desde}` : `${desde} a ${siguiente - 1}`;
}

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );

/**
 * La hoja de las normas, completa, con la escala de precios vigente.
 *
 * Es un componente aparte porque se lee en dos lugares: en /centro/normas
 * (con la barra, si hay sesión) y debajo del formulario de elegir la
 * contraseña, para aceptarlas sin salir de esa página ni entrar al sistema.
 */
export default async function HojaNormas({ pie }: { pie?: React.ReactNode }) {
  // La escala vigente, para que quien lee la norma vea los números con los
  // que se le va a cobrar y no tenga que entrar a Reservar a buscarlos.
  const [escala, espacios] = await Promise.all([escalaVigente(hoyISO()), listarEspacios()]);
  const salas = espacios.filter((e) => e.activo && escala.tarifas.some((t) => t.espacio_id === e.id));
  const tramos = [...new Set(escala.tarifas.map((t) => t.horas_semana_desde))].sort((a, b) => a - b);
  const precioDe = (salaId: string, tramo: number) =>
    escala.tarifas.find((t) => t.espacio_id === salaId && t.horas_semana_desde === tramo)?.precio_hora;

  return (
    <article className="centro-hoja">
      <header className="centro-hoja-membrete">
        <div className="centro-hoja-marca">Centro Integral Santiago</div>
        <div className="centro-hoja-direccion">Santiago 1269, Rosario</div>
      </header>
      <h1 className="centro-hoja-titulo">Compromiso y normas de convivencia</h1>
      <p className="centro-hoja-version">
        Última actualización: {NORMAS_FECHA} · versión {NORMAS_VERSION}
      </p>

      {/* Numeración decimal, como en un reglamento: el bloque es el
          artículo (1, 2, 3) y cada norma lleva su número adentro (1.1,
          1.2). Así un punto se cita solo: "la 3.4". */}
      {NORMAS.map((b, k) => (
        <section key={b.id} id={b.id} className="centro-hoja-articulo">
          <header className="centro-hoja-articulo-top">
            <span className="centro-hoja-numero">{k + 1}</span>
            <h2>{b.titulo}</h2>
          </header>
          <ol className="centro-normas-lista">
            {b.items.map((t, i) => (
              <li key={i} id={`${k + 1}.${i + 1}`}>
                <span className="centro-normas-numero">
                  {k + 1}.{i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          {b.id === 'precio-y-pago' && salas.length > 0 && (
            <div className="centro-hoja-precios">
              <p className="centro-hoja-precios-titulo">
                Precio de la hora, según las horas fijas por semana. Escala vigente
                {escala.desde ? ` desde el ${fechaLarga(escala.desde)}` : ''}.
              </p>
              <table className="centro-resumen">
                <thead>
                  <tr>
                    <th>Horas por semana</th>
                    {salas.map((e) => (
                      <th key={e.id} className="centro-num">
                        {e.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tramos.map((tramo, i) => (
                    <tr key={tramo}>
                      <td>{nombreDelTramo(tramo, tramos[i + 1])}</td>
                      {salas.map((e) => {
                        const p = precioDe(e.id, tramo);
                        return (
                          <td key={e.id} className="centro-num">
                            {p === undefined ? '—' : pesos(p)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <p className="centro-hoja-cierre">
        Al apretar "Las leí y las acepto", al pie de esta hoja, dejás constancia de que leíste
        estos puntos y te comprometés a respetarlos. Queda registrado con la versión y la fecha,
        en lugar de la firma en papel.
      </p>
      {pie}
    </article>
  );
}
