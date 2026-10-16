import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { finDeMes, hoyISO, listarEspacios, mesCorrido, periodoDe, reservasDe } from '@/lib/consultorios';
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
  // Del mes anterior al que viene: lo que el calendario deja recorrer.
  const desde = mesCorrido(periodoDe(hoy), -1);
  const hasta = finDeMes(mesCorrido(periodoDe(hoy), 1));

  const [reservas, espacios, turnos, usados, fichas] = await Promise.all([
    reservasDe(yo.id),
    listarEspacios(),
    turnosDe(yo.id, desde, hasta),
    nombresUsados(yo.id),
    pacientesDe(yo.id),
  ]);
  // Para completar al escribir: primero las fichas, después los nombres ya
  // usados en la agenda que no tienen ficha.
  const nombresDeFichas = fichas.map(nombreCompleto);
  const pacientes = [...nombresDeFichas, ...usados.filter((u) => !nombresDeFichas.includes(u))];

  if (yo.mirando) {
    return (
      <>
        <Barra nombre={yo.nombre} donde="/centro/turnos" />
        <main className="centro-cuerpo">
          <h1 className="centro-titulo">Mis turnos</h1>
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
        reservas={reservas
          .filter((r) => r.fecha >= desde && r.fecha <= hasta)
          .map((r) => ({
            id: r.id,
            fecha: r.fecha,
            desde: r.desde_hora,
            hasta: r.hasta_hora,
            sala: espacios.find((e) => e.id === r.espacio_id)?.nombre ?? 'Sala',
          }))}
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
