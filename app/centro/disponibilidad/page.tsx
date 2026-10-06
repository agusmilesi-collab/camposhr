import type { Metadata } from 'next';
import {
  contratos as leerContratos,
  DIAS_CORTOS,
  DIAS_DE_LA_SEMANA_TIPO,
  esParaTodos,
  hoyISO,
  listarEspacios,
  mesLargo,
  periodoDe,
  aperturas as leerAperturas,
  reservasEntre,
  semanaTipo,
  sumarDias,
} from '@/lib/consultorios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Disponibilidad · Centro Integral Santiago',
  description: 'Las horas libres de cada consultorio, de lunes a viernes.',
};

/**
 * La disponibilidad del Centro, para quien pregunta por alquilar.
 *
 * **Se abre sin sesión.** Es la respuesta a "¿qué tenés libre?", y quien lo
 * pregunta todavía no es inquilino. Por eso de acá no sale nada que no se le
 * diría por teléfono: qué hora de qué sala está libre. Ni nombres, ni precios,
 * ni fechas; las reservas se reducen a libre u ocupada antes de dibujar.
 *
 * Muestra la semana tipo y no el mes: se alquila por banda fija, y una hora
 * libre este martes pero tomada los otros tres no es una hora para ofrecer.
 * La cuenta está en `semanaTipo`.
 */
export default async function Disponibilidad() {
  const hoy = hoyISO();
  const [espacios, aperturas, contratos, reservas] = await Promise.all([
    listarEspacios(),
    leerAperturas(),
    leerContratos(),
    reservasEntre(hoy, sumarDias(hoy, DIAS_DE_LA_SEMANA_TIPO - 1)),
  ]);
  // Las salas fuera de alquiler no se ofrecen, y tampoco las que se alquilan
  // solo a quienes se elige: esta página la abre cualquiera.
  const salas = espacios.filter((e) => e.activo && esParaTodos(e));
  const { horas, dias, celdas } = semanaTipo(salas, aperturas, contratos, reservas, hoy);

  return (
    <main className="centro-cuerpo centro-oferta">
      <h1 className="centro-titulo">Centro Integral Santiago</h1>
      <p className="centro-bajada">
        Santiago 1269, Rosario. Disponibilidad de {mesLargo(periodoDe(hoy))}: las horas libres de
        cada consultorio para alquilar todas las semanas, de lunes a viernes.
      </p>
      <p className="centro-oferta-leyenda">
        <span>
          <i style={{ background: '#e4e1da' }} />
          Libre
        </span>
        <span>
          <i style={{ background: '#8fb0d9' }} />
          Ocupada
        </span>
      </p>

      <div className="centro-oferta-salas">
        {salas.map((sala) => {
          const libres = dias.reduce(
            (n, d) => n + horas.filter((h) => celdas[`${sala.id}|${d}|${h}`] === 'libre').length,
            0
          );
          return (
            <section className="centro-panel" key={sala.id}>
              <h2>{sala.nombre}</h2>
              <p className="centro-oferta-cuenta">
                {libres === 0
                  ? 'Sin horas libres'
                  : `${libres} ${libres === 1 ? 'hora libre' : 'horas libres'} por semana`}
              </p>
              <table className="centro-semana">
                <thead>
                  <tr>
                    <th />
                    {dias.map((d) => (
                      <th key={d}>{DIAS_CORTOS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horas.map((h) => (
                    <tr key={h}>
                      <th>{h} a {h + 1}</th>
                      {dias.map((d) => {
                        const estado = celdas[`${sala.id}|${d}|${h}`];
                        return (
                          <td
                            key={d}
                            className={estado}
                            title={`${DIAS_CORTOS[d]} de ${h} a ${h + 1}: ${estado}`}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sala.incluye.length > 0 && (
                <p className="centro-oferta-incluye">
                  {sala.incluye.map((i) => i.texto).join(' · ')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
