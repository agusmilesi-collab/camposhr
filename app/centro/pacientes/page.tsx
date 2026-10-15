import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { consultasPorPaciente, pacientesDe } from '@/lib/pacientes';
import Barra from '../Barra';
import Lista from './Lista';

export const dynamic = 'force-dynamic';

/**
 * Pacientes: las fichas de la consulta del inquilino.
 *
 * La lista y el alta. La historia clínica de cada uno vive en su ficha.
 * En modo mirar desde el OS no se abre: es de la persona, no del Centro.
 */
export default async function Pacientes() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  if (yo.mirando) {
    return (
      <>
        <Barra nombre={yo.nombre} donde="/centro/pacientes" />
        <main className="centro-cuerpo">
          <h1 className="centro-titulo">Pacientes</h1>
          <div className="centro-panel">
            <p className="centro-nota" style={{ margin: 0 }}>
              Las fichas de los pacientes las ve solo el profesional. Desde el OS esta pantalla no
              se abre.
            </p>
          </div>
        </main>
      </>
    );
  }

  const [pacientes, consultas] = await Promise.all([pacientesDe(yo.id), consultasPorPaciente(yo.id)]);

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/pacientes" />
      <Lista
        pacientes={pacientes.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          apellido: p.apellido,
          telefono: p.telefono,
          consultas: consultas[p.id]?.cantidad ?? 0,
          ultima: consultas[p.id]?.ultima ?? null,
        }))}
      />
    </>
  );
}
