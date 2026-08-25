'use client';

/**
 * Las piezas que compartían las tablas del pipeline.
 *
 * Vivían en `Tabla.tsx`, que dejó de existir el 24/8/2026 cuando Sin asignar y
 * Entrevistas pasaron a ser tableros. Las usan las dos tablas que quedaron,
 * Entregados y Facturación.
 */

import { diasDesde, fechaCorta } from '@/lib/hora';

/**
 * Cuánto mide cada columna, por el nombre del campo.
 *
 * Fijo y por campo, no por posición: un campo mide lo mismo en cualquier tabla,
 * así pasar de una pantalla a otra no mueve nada de lugar. Sin esto, cada tabla
 * repartía el ancho según su contenido.
 *
 * Los valores están calibrados para que ninguna tabla pase de 1200 px, que es
 * lo que entra sin desplazar en una pantalla de trabajo.
 */
/*
 * Entregados es la tabla más ancha del sistema: diez columnas. Suma 1062 px y
 * no los 1200 del tope, porque con la barra lateral puesta una pantalla de
 * trabajo da unos 1060: pasados esos, la tabla se comprime y los rótulos
 * empiezan a cortarse. Cada ancho es el que pide su rótulo **más la flecha de
 * ordenar**, medido en pantalla, porque acá los rótulos son más largos que los
 * valores. Lo que sobra va a empresa y puesto, que son los que se recortan. Sumar una columna obliga a sacar otra.
 */
export const ANCHO: Record<string, number> = {
  Candidato: 134,
  /* Las cuatro de lo ya facturado. El cliente y "cubre" se recortan; los otros
     dos miden lo que piden "0001-00000123" y "Lorena Campos" enteros. */
  'Número': 132,
  Emisora: 134,
  Cliente: 150,
  Cubre: 131,
  Pedido: 190,
  /* Empresa y puesto van en columnas separadas en Entregados: juntas en una
     celda de dos renglones, la fila era la única del sistema que medía doble.
     Miden lo que pide un nombre de cliente corriente; los largos, como
     "Fideicomiso Financiero UPR", se recortan con puntos suspensivos. */
  Empresa: 158,
  /* Facturación es la única tabla donde el puesto va solo, sin la empresa
     arriba: el panel entero es de un cliente. */
  Puesto: 150,
  Etapa: 132,
  Importe: 130,
  /* Lo que mide "B1 + bzg", que es el sello más largo, medido en pantalla. */
  Batería: 92,
  Teléfono: 158,
  Contacto: 144,
  Entrevista: 174,
  Modalidad: 122,
  Esperando: 110,
  Espera: 120,
  Informe: 118,
  /* "Ver ficha" con su padding: 55 el texto y 22 el del botón, más los 28 de
     la celda. Con 88 el botón perdía su padding y el texto quedaba contra los
     dos bordes. */
  Ficha: 110,
  /* Los rótulos son "Factura" y "Cobro", que es lo que entra arriba de un
     sello de dos letras. */
  Factura: 96,
  Cobro: 80,
  /* "Ajuste con aspectos a desarrollar" es el nombre de conclusión más largo.
     Con 222 la tabla de Entregados se pasaba de los 1200 al sumarle la columna
     de seguimiento, y el texto se recorta con puntos suspensivos igual. */
  Conclusión: 186,
  Entregado: 110,
  /* En Entregados la fecha abre la fila, y ahí el rótulo "Entregado" no entra
     en su columna: se llama "Fecha", que además es lo que se lee cuando va
     primera. */
  Fecha: 100,
  /* En Entregados va solo el nombre de pila, así que el ancho lo pide el
     rótulo "EVALUADORA" y no el valor. */
  Evaluadora: 120,
  Ingresó: 118,
  Seguimiento: 120,
  /* Cuánto queda para los noventa días: "faltan 12 días", "venció hace 3". */
  Faltan: 150,
  /* "Sin preguntar" es lo más largo que dice, y el rótulo mide casi igual. */
  'Cómo le fue': 118,
  /* La columna de la acción, con el botón más ancho. */
  '': 166,
};

/**
 * El `colgroup` de una tabla: cada columna en proporción a lo que pide.
 *
 * La tabla ocupa el panel entero y cada columna se lleva su parte, medida sobre
 * el contenido y el rótulo más largos. Va en porcentajes y no en píxeles porque
 * la tabla tiene que llenar el panel en cualquier pantalla: en píxeles, o
 * sobraba un tercio del panel en blanco a la derecha, o faltaba y aparecía
 * desplazamiento horizontal.
 *
 * **En proporción y no en partes iguales.** Repartir el sobrante por igual
 * entre todas dejaba a cada una con la mitad de su ancho en blanco: la fecha de
 * entrevista medía 236 px para mostrar "28/8/26" mientras el puesto se
 * recortaba. Así, la que pide más crece más, y ninguna queda con el rótulo en
 * una punta y el dato en la otra.
 *
 * **`propios` es la excepción medida de una tabla.** El ancho de referencia
 * vale mientras el campo muestre lo mismo en las dos; cuando no, forzarlo rompe
 * a las dos a la vez. El puesto se recorta en Entregados, que lo lleva al lado
 * de la empresa, y va entero en Facturación, donde el panel es de un solo
 * cliente. Cada excepción se declara donde se usa y con el porqué.
 */
export function columnas(nombres: string[], propios: Record<string, number> = {}) {
  const base = nombres.map((c) => propios[c] ?? ANCHO[c] ?? 140);
  const total = base.reduce((n, x) => n + x, 0);
  return base.map((n) => `${((n / total) * 100).toFixed(3)}%`);
}

/** Un dato que falta, dicho y no escondido. */
export function Falta({ texto = 'falta' }: { texto?: string }) {
  return <span className="os-dato-falta">{texto}</span>;
}

/**
 * Cuánto queda para los noventa días.
 *
 * El seguimiento se hace a los noventa días de que la persona entró a trabajar,
 * así que la cuenta solo existe si entró: sin ingreso no hay reloj, y sin fecha
 * de ingreso hay uno que nadie puso a andar. Vencido va en ámbar, que es cuando
 * hay que salir a preguntar.
 */
export function Cuenta({ al, ingreso }: { al: string | null; ingreso: boolean | null }) {
  if (ingreso === false) return <span className="os-tabla-flojo">no ingresó</span>;
  if (ingreso === null) return <Falta texto="sin saber si entró" />;
  if (!al) return <Falta texto="sin fecha" />;
  const dias = diasDesde(al);
  if (dias === null) return <Falta texto="sin fecha" />;
  if (dias > 0) {
    return (
      <span className="os-sello-estado os-ambar">
        {dias === 1 ? 'venció ayer' : `venció hace ${dias} días`}
      </span>
    );
  }
  if (dias === 0) return <span className="os-sello-estado os-ambar">es hoy</span>;
  const faltan = Math.abs(dias);
  return (
    <span className="os-tabla-num" title={`Toca el ${fechaCorta(al)}`}>
      {faltan === 1 ? 'falta 1 día' : `faltan ${faltan} días`}
    </span>
  );
}
