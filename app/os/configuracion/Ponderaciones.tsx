import Pesos, { type Hoja } from './Pesos';
import {
  HOJAS,
  PESOS_DE_FABRICA,
  claveDePeso,
  conDireccion,
  numerosDe,
} from '@/lib/competencias';
import { loQueRige } from '@/lib/informe';

/**
 * El velocímetro: dónde corta cada indicador y cuánto pesa en su competencia.
 *
 * Se llama así por lo que produce, que es la aguja de cada competencia en el
 * informe.
 *
 * Cada indicador cae en una de tres bandas y aporta cien, cincuenta o cero. El
 * puntaje de la competencia es el promedio de esos aportes, cada uno por su
 * peso. Las dos cosas que deciden ese número se editan acá: **dónde corta** cada
 * indicador entre bajo, medio y alto, y **cuánto pesa** frente a los otros.
 *
 * Los pesos son criterio clínico: que la calidad del vínculo valga el doble que
 * el índice de egocentrismo en Habilidad interpersonal es una decisión sobre qué
 * define esa competencia, no una cuenta.
 *
 * Las filas se arman acá y no en el componente porque cada indicador trae su
 * función de nivel, que no viaja al navegador. Lo que viaja es la escala, que
 * es dato: con eso la pantalla escribe las tres bandas y deja mover sus
 * números.
 */
export default async function Ponderaciones() {
  const rige = await loQueRige();
  const movidos = rige.pesos;
  const cortes = rige.cortesCompetencias;
  const direcciones = rige.direcciones;

  const hojas: Hoja[] = Object.entries(HOJAS).map(([test, hoja]) => ({
    test,
    competencias: hoja.map((c) => ({
      nombre: c.competencia,
      mide: c.mide,
      indicadores: c.indicadores.map((i) => {
        const clave = claveDePeso(test, c.competencia, i.nombre);
        return {
          clave,
          nombre: i.nombre,
          mide: i.mide,
          // La escala con la dirección que rige, que puede no ser la del
          // código: hacia dónde es mejor se elige por indicador.
          escala: i.escala ? conDireccion(i.escala, direcciones[clave]) : null,
          // La del código, para poder decir que se invirtió.
          escalaFabrica: i.escala ?? null,
          reglas: i.reglas ? [...i.reglas] : null,
          formula: i.formula,
          cortes: i.escala ? (cortes[clave] ?? numerosDe(i.escala)) : [],
          cortesFabrica: i.escala ? numerosDe(i.escala) : [],
          peso: movidos[clave] ?? PESOS_DE_FABRICA[clave],
          fabrica: PESOS_DE_FABRICA[clave],
        };
      }),
    })),
  }));

  return (
    <Pesos
      hojas={hojas}
      tocado={Object.keys(movidos).length > 0}
      cortesTocados={Object.keys(cortes).length > 0 || Object.keys(direcciones).length > 0}
    />
  );
}
