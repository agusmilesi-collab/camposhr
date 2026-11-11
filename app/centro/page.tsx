import Link from 'next/link';
import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion, legajoAlDia } from '@/lib/centro-sesion';
import { NORMAS_VERSION } from '@/lib/centro-acceso';
import {
  cierresEntre,
  contratos as leerContratos,
  escalaVigente,
  hoyISO,
  listarEspacios,
  periodoDe,
  puedeAlquilar,
  aperturas as leerAperturas,
  reservasEntre,
  sumarDias,
} from '@/lib/consultorios';
import Barra from './Barra';
import Reservar from './Reservar';
import { horasSoltadasEn } from '@/lib/consultorios-escritura';

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

  // Solo las salas que se le ofrecen a esta persona: una sala reservada para
  // algunos no existe para el resto, ni libre ni ocupada.
  const activos = espacios.filter((e) => puedeAlquilar(e, yo.id));
  // De una reserva ajena tampoco viajan su id ni el de quien la hizo: con el id
  // de inquilino se podía seguir a una misma persona por toda la grilla, y los
  // ids de reserva son los que aceptan las rutas que liberan y cobran.
  const sinNombres = reservas.map((r, i) => {
    const mia = r.inquilino_id === yo.id;
    return {
      id: mia ? r.id : `ajena-${i}`,
      espacio_id: r.espacio_id,
      inquilino_id: mia ? r.inquilino_id : '',
      fecha: r.fecha,
      desde_hora: r.desde_hora,
      hasta_hora: r.hasta_hora,
      origen: r.origen,
      estado: r.estado,
      importe: mia ? r.importe : null,
      // Solo de lo propio: cuándo se creó la reserva de otro no es asunto de
      // quien mira, y de acá sale si todavía se puede deshacer.
      created_at: mia ? r.created_at : undefined,
      inquilinos: null,
    };
  });
  // La pantalla usa los contratos para contar las horas fijas propias: los de
  // los demás (quién, qué sala, a qué hora y por cuánto) no tienen por qué
  // llegar al navegador.
  const misContratos = contratos.filter((c) => c.inquilino_id === yo.id);

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro" />
      <main className="centro-cuerpo">
        <h1 className="centro-titulo">Reservá tu consultorio</h1>
        <p className="centro-bajada">
          Lo que reservás se cobra, así que confirmá solo lo que vas a usar.
        </p>

        {!legajoAlDia(yo, hoy) && (
          <div className="centro-panel centro-aviso">
            <h2>Falta tu matrícula</h2>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Para reservar hace falta tu matrícula profesional cargada en tu
              legajo. Mandásela a Lorena o a Lucila y la cargan.
            </p>
          </div>
        )}

        {/* Sin las normas aceptadas la grilla no deja reservar, y tocar una
            celda no hacía nada: Victoria Perino no entendía por qué
            (11/11/2026). El motivo va arriba, con el camino para resolverlo. */}
        {legajoAlDia(yo, hoy) && yo.normas_version !== NORMAS_VERSION && (
          <div className="centro-panel centro-aviso">
            <h2>{yo.normas_aceptadas_at ? 'Las normas cambiaron' : 'Falta aceptar las normas'}</h2>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Para reservar, primero leé las normas del Centro y aceptalas al pie.{' '}
              <Link href="/centro/normas">Ir a las normas</Link>
            </p>
          </div>
        )}

        <Reservar
          espacios={activos}
          aperturas={aperturas}
          cierres={cierres}
          reservas={sinNombres}
          contratos={misContratos}
          tarifas={escala.tarifas}
          miId={yo.id}
          hoy={hoy}
          puedeReservar={legajoAlDia(yo, hoy) && yo.normas_version === NORMAS_VERSION}
          soltadas={await horasSoltadasEn(yo.id, periodoDe(hoy))}
        />
      </main>
    </>
  );
}
