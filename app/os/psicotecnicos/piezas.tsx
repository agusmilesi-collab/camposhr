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
  Candidato: 108,
  Pedido: 190,
  /* Empresa y puesto van en columnas separadas en Entregados: juntas en una
     celda de dos renglones, la fila era la única del sistema que medía doble.
     "Fideicomiso Financiero UPR" es el nombre de cliente más largo. */
  Empresa: 112,
  /* Facturación es la única tabla donde el puesto va solo, sin la empresa
     arriba: el panel entero es de un cliente. */
  Puesto: 100,
  Etapa: 132,
  Importe: 130,
  /* Lo que mide "B1 + bzg", que es el sello más largo. */
  Batería: 92,
  Teléfono: 158,
  Contacto: 144,
  Entrevista: 174,
  Modalidad: 122,
  Esperando: 110,
  Espera: 120,
  Informe: 118,
  /* "Ver ficha" con su padding. */
  Ficha: 88,
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
     rótulo y no el valor. */
  Evaluadora: 130,
  Ingresó: 118,
  Seguimiento: 124,
  /* Cuánto queda para los noventa días: "faltan 12 días", "venció hace 3". */
  Faltan: 150,
  /* "Sin preguntar" es la opción más larga del selector, y con 150 se cortaba
     en el botón. */
  'Cómo le fue': 124,
  /* La columna de la acción, con el botón más ancho. */
  '': 166,
};

/**
 * Secciones donde todas las tablas miden lo mismo.
 *
 * Son las que apilan varias tablas, una por cliente: sin un ancho parejo cada
 * una mediría lo que pide su contenido y la pantalla se leería como una pila de
 * listas sueltas.
 */
const ANCHO_PAREJO: Record<string, number> = {
  facturacion: 1200,
};

/**
 * El ancho de cada columna, ya repartido el sobrante de la sección.
 *
 * La diferencia se reparte en partes iguales entre las columnas de datos, así
 * la tabla más corta queda con los campos espaciados igual que la larga. La
 * columna de la acción no participa: su botón mide lo que mide y el aire de más
 * lo alejaría de la fila.
 */
export function anchos(columnas: string[], seccion: string): number[] {
  const base = columnas.map((c) => ANCHO[c] ?? 140);
  const total = ANCHO_PAREJO[seccion];
  if (!total) return base;

  const sobra = total - base.reduce((n, x) => n + x, 0);
  const datos = columnas.map((c, i) => (c === '' ? -1 : i)).filter((i) => i >= 0);
  if (sobra <= 0 || datos.length === 0) return base;

  const salida = [...base];
  const parte = Math.floor(sobra / datos.length);
  datos.forEach((i) => (salida[i] += parte));
  // Lo que no entra en la división va a la primera, que es la que se lee.
  salida[datos[0]] += sobra - parte * datos.length;
  return salida;
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
