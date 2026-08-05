/**
 * Personas inventadas para ver cómo se comporta la matriz con un grupo grande.
 *
 * No se guardan: se arman en memoria y viven lo que dura el render de la
 * pantalla de prueba. La versión anterior de esto insertaba filas en la base
 * de la empresa, y quedaban mezcladas con las respuestas reales del taller.
 */
import { calcular, PERFILES, type Perfil, type Puntajes } from './perfiles';
import { PLACAS } from './cuestionario';

const GENTE: [string, string][] = [
  ['Aguirre', 'Matías'], ['Almirón', 'Sofía'], ['Barreto', 'Nicolás'],
  ['Benítez', 'Carolina'], ['Cabrera', 'Federico'], ['Cardozo', 'Valentina'],
  ['Castro', 'Emiliano'], ['Coronel', 'Julieta'], ['Domínguez', 'Leandro'],
  ['Escobar', 'Micaela'], ['Ferreyra', 'Gonzalo'], ['Figueroa', 'Rocío'],
  ['Gauna', 'Sebastián'], ['Godoy', 'Antonella'], ['Gutiérrez', 'Maximiliano'],
  ['Ibarra', 'Guadalupe'], ['Ledesma', 'Facundo'], ['Luna', 'Camila'],
  ['Maidana', 'Joaquín'], ['Medina', 'Agustina'], ['Molina', 'Tomás'],
  ['Ojeda', 'Brenda'], ['Olivera', 'Ezequiel'], ['Paz', 'Milagros'],
  ['Peralta', 'Ramiro'], ['Quiroga', 'Lucía'], ['Ramírez', 'Bautista'],
  ['Rivero', 'Delfina'], ['Sosa', 'Lautaro'], ['Suárez', 'Abril'],
  ['Toledo', 'Ignacio'], ['Vera', 'Martina'], ['Villalba', 'Franco'],
  ['Zárate', 'Renata'], ['Acosta', 'Santino'], ['Bordón', 'Pilar'],
  ['Chávez', 'Thiago'], ['Duarte', 'Malena'], ['Farías', 'Ulises'],
  ['Gómez', 'Zoe'],
];

export const MAXIMO_FICTICIAS = GENTE.length;

/** Aleatorio con semilla: la misma corrida da siempre las mismas personas. */
function dado(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const ceros = (): Puntajes => ({ FI: 0, FD: 0, BI: 0, BD: 0 });

export type Ficticia = {
  id: string;
  apellido: string;
  nombre: string;
  totales: Puntajes;
  perfiles: Perfil[];
};

/**
 * Arma `cuantas` personas con una inclinación dominante y algo de ruido, para
 * que la nube tenga gente en los cuatro cuadrantes y también repartida.
 */
export function personasFicticias(cuantas: number): Ficticia[] {
  const cantidad = Math.max(0, Math.min(cuantas, GENTE.length));

  return GENTE.slice(0, cantidad).map(([apellido, nombre], i) => {
    const r = dado(i * 7919 + 13);
    const fuerte = PERFILES[i % 4];
    const likert = ceros();
    const checklist = ceros();

    for (const placa of PLACAS) {
      const p = placa.perfil as Perfil;
      const suyo = p === fuerte;
      if (placa.tipo === 'descriptiva') {
        likert[p] += suyo ? 4 + Math.round(r()) : Math.round(r() * 4);
      } else {
        checklist[p] += suyo ? 9 + Math.floor(r() * 6) : Math.floor(r() * 9);
      }
    }

    const res = calcular(likert, checklist);
    return {
      id: `ficticia-${i}`,
      apellido,
      nombre,
      totales: res.totales,
      perfiles: res.perfiles,
    };
  });
}
