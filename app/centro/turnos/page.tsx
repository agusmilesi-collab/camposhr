import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import {
  contratos as leerContratos,
  finDeMes,
  horasPrevistas,
  hoyISO,
  listarEspacios,
  mesCorrido,
  MESES_PREVISTOS,
  periodoDe,
  reservasDe,
} from '@/lib/consultorios';
import { feriadosEntre } from '@/lib/feriados';
import { pacientesDe as nombresUsados, turnosDe } from '@/lib/turnos';
import { nombreCompleto, pacientesDe } from '@/lib/pacientes';
import Barra from '../Barra';
import Turnos from './Turnos';

export const dynamic = 'force-dynamic';


/**
 * Mis turnos: la agenda de la consulta adentro de las horas reservadas.
 *
 * No es un calendario propio: son las reservas del inquilino, hora por hora,
 * con un lugar para anotar a quién atiende en cada una. Lo que no está
 * reservado no aparece, porque no tiene sala.
 */
export default async function MisTurnos() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  const hoy = hoyISO();
  // Del mes anterior hasta tres meses adelante: lo que el calendario deja
  // recorrer. Hacia adelante, las horas fijas se proyectan desde el contrato.
  const desde = mesCorrido(periodoDe(hoy), -1);
  const hasta = finDeMes(mesCorrido(periodoDe(hoy), MESES_PREVISTOS));
  const primerMesPrevisto = mesCorrido(periodoDe(hoy), 1);

  const [reservas, espacios, turnos, usados, fichas, contratos, feriados] = await Promise.all([
    reservasDe(yo.id),
    listarEspacios(),
    turnosDe(yo.id, desde, hasta),
    nombresUsados(yo.id),
    pacientesDe(yo.id),
    leerContratos(),
    feriadosEntre(primerMesPrevisto, hasta),
  ]);
  // Las horas fijas de los meses que vienen, previstas: solo donde todavía no
  // hay reserva de verdad (el día 1 las reemplazan).
  const previstas = horasPrevistas(
    contratos,
    yo.id,
    primerMesPrevisto,
    hasta,
    feriados.map((f) => f.fecha)
  ).filter((p) => !reservas.some((r) => r.fecha === p.fecha && r.espacio_id === p.espacio_id && r.desde_hora === p.desde_hora));
  // Para completar al escribir: primero las fichas, después los nombres ya
  // usados en la agenda que no tienen ficha.
  const nombresDeFichas = fichas.map(nombreCompleto);
  const pacientes = [...nombresDeFichas, ...usados.filter((u) => !nombresDeFichas.includes(u))];

  if (yo.mirando) {
    return (
      <>
        <Barra nombre={yo.nombre} donde="/centro/turnos" />
        <main className="centro-cuerpo">
          <h1 className="centro-titulo">Turnos</h1>
          <div className="centro-panel">
            <p className="centro-nota" style={{ margin: 0 }}>
              A quién atiende cada profesional lo ve solo esa persona. Desde el OS esta pantalla
              no se abre.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/turnos" />
      <Turnos
        hoy={hoy}
        reservas={[
          ...reservas
            .filter((r) => r.fecha >= desde && r.fecha <= hasta)
            .map((r) => ({
              id: r.id,
              fecha: r.fecha,
              desde: r.desde_hora,
              hasta: r.hasta_hora,
              sala: espacios.find((e) => e.id === r.espacio_id)?.nombre ?? 'Sala',
            })),
          ...previstas.map((p) => ({
            id: `prevista|${p.fecha}|${p.desde_hora}|${p.espacio_id}`,
            fecha: p.fecha,
            desde: p.desde_hora,
            hasta: p.hasta_hora,
            sala: espacios.find((e) => e.id === p.espacio_id)?.nombre ?? 'Sala',
            prevista: true,
          })),
        ]}
        turnos={turnos.map((t) => ({
          fecha: t.fecha,
          hora: Number(t.desde_hora.slice(0, 2)),
          paciente: t.paciente,
          pacienteId: t.paciente_id,
        }))}
        pacientes={pacientes}
      />
    </>
  );
}
