import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion, legajoAlDia } from '@/lib/centro-sesion';
import {
  cierresEntre,
  contratos as leerContratos,
  escalaVigente,
  hoyISO,
  listarEspacios,
  aperturas as leerAperturas,
  reservasEntre,
  sumarDias,
} from '@/lib/consultorios';
import Barra from './Barra';
import Reservar from './Reservar';

export const dynamic = 'force-dynamic';

/**
 * Lo que ve el inquilino: qué hay libre, cuánto sale y qué reservó.
 *
 * **De las reservas ajenas sale solo que la hora está tomada.** Quién alquila la
 * sala de al lado no es asunto de quien busca un hueco, así que el nombre no
 * llega al navegador: se limpia acá, antes de mandar los datos.
 */
export default async function Centro() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const hoy = hoyISO();
  const hasta = sumarDias(hoy, 35);

  const [espacios, aperturas, cierres, reservas, contratos, escala] = await Promise.all([
    listarEspacios(),
    leerAperturas(),
    cierresEntre(hoy, hasta),
    reservasEntre(hoy, hasta),
    leerContratos(),
    escalaVigente(hoy),
  ]);

  const activos = espacios.filter((e) => e.activo);
  const sinNombres = reservas.map((r) => ({
    id: r.id,
    espacio_id: r.espacio_id,
    inquilino_id: r.inquilino_id,
    fecha: r.fecha,
    desde_hora: r.desde_hora,
    hasta_hora: r.hasta_hora,
    origen: r.origen,
    estado: r.estado,
    importe: r.inquilino_id === yo.id ? r.importe : null,
    // Solo de lo propio: cuándo se creó la reserva de otro no es asunto de
    // quien mira, y de acá sale si todavía se puede deshacer.
    created_at: r.inquilino_id === yo.id ? r.created_at : undefined,
    inquilinos: null,
  }));

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Reservá tu consultorio</h1>
        <p className="centro-bajada">
          De lunes a viernes, de 8 a 20. Lo que reservás se cobra, así que
          confirmá solo lo que vas a usar.
        </p>

        {!legajoAlDia(yo, hoy) && (
          <div className="centro-panel centro-aviso">
            <h2>Falta tu matrícula</h2>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Para reservar hace falta la matrícula profesional vigente cargada
              en tu legajo. Mandásela a Lorena o a Lucila y la suben.
            </p>
          </div>
        )}

        <Reservar
          espacios={activos}
          aperturas={aperturas}
          cierres={cierres}
          reservas={sinNombres}
          contratos={contratos}
          tarifas={escala.tarifas}
          miId={yo.id}
          hoy={hoy}
          puedeReservar={legajoAlDia(yo, hoy) && Boolean(yo.normas_aceptadas_at)}
        />
      </main>
    </>
  );
}
