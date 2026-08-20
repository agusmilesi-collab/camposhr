/**
 * El informe Benziger, leído.
 *
 * Toma lo que se extrajo del PDF, que está guardado tal como vino, y arma lo
 * que la pantalla dibuja: las cuatro filas del perfil, las cruces con su
 * lectura, el estilo que da la alerta, el estado emocional, lo cualitativo y
 * los acontecimientos del último año.
 *
 * Vive separado de la extracción a propósito. Lo que sale del PDF es un dato
 * crudo que no se toca; esto es la lectura, y la lectura puede cambiar sin
 * volver a leer ningún PDF.
 */

import {
  cuentaElTiempoLibre,
  estiloDeAlerta,
  eventosOcurridos,
  leerCruz,
  type Cruz,
  type Cuatro,
  type Estilo,
} from '@/lib/benziger-perfil';

/** Las cuatro columnas de una fila del informe, con el prefijo que usa el PDF. */
function cuatro(datos: Record<string, unknown>, prefijo: string): Cuatro {
  const n = (sufijo: string) => {
    const x = datos[`${prefijo}_${sufijo}`];
    return x === null || x === undefined || x === '' ? null : Number(x);
  };
  return { FI: n('fi'), BI: n('bi'), BD: n('bd'), FD: n('fd') };
}

function texto(datos: Record<string, unknown>, clave: string): string | null {
  const x = datos[clave];
  const s = x === null || x === undefined ? '' : String(x).trim();
  return s || null;
}

function numero(datos: Record<string, unknown>, clave: string): number | null {
  const x = datos[clave];
  return x === null || x === undefined || x === '' ? null : Number(x);
}

/** Cuántos adjetivos positivos, determinados y negativos se eligieron. */
export type Conteo = { pos: number | null; det: number | null; neg: number | null };

export type Lectura = {
  /** Las filas del perfil adulto, más el total joven. */
  filas: { titulo: string; valores: Cuatro }[];
  cruces: Cruz[];
  tiempoLibre: { cuenta: boolean; respuesta: string | null };
  alerta: { adulto: number | null; joven: number | null; estiloAdulto: Estilo | null; estiloJoven: Estilo | null };
  autoimagen: { imagen: string | null; adjetivo: string | null };
  emocional: {
    /** Los tres recuentos de un período, o del total. */
    total: Conteo;
    q56: Conteo & { ponderado: string | null; adjetivos: string | null };
    q57: Conteo & { ponderado: string | null; adjetivos: string | null };
  };
  abiertas: { rotulo: string; texto: string }[];
  estres: { puntos: number | null; eventos: { texto: string; veces: number }[] };
};

export function leerBenziger(
  cuadrantes: Record<string, unknown>,
  adjetivos: Record<string, unknown>,
  abiertas: Record<string, unknown>,
  estres: Record<string, unknown>
): Lectura {
  const trabajo = cuatro(cuadrantes, 'trabajo');
  const tiempolibre = cuatro(cuadrantes, 'tiempolibre');
  const autopercepcion = cuatro(cuadrantes, 'autopercepcion');
  const totalAdulto = cuatro(cuadrantes, 'total_adulto');
  const totalJoven = cuatro(cuadrantes, 'total_joven');

  const q4 = texto(abiertas, 'q4_tiempo_libre');
  const cuenta = cuentaElTiempoLibre(q4);

  const cruces = [
    leerCruz('Trabajo', trabajo),
    // El tiempo libre solo entra en la lectura si la persona lo pasa haciendo
    // lo que quiere; si no, habla de sus obligaciones y no de su preferencia.
    ...(cuenta ? [leerCruz('Tiempo libre', tiempolibre)] : []),
    leerCruz('Total adulto', totalAdulto),
    leerCruz('Total joven', totalJoven),
  ];

  const alertaAdulto = numero(cuadrantes, 'nivel_alerta_adulto');
  const alertaJoven = numero(cuadrantes, 'nivel_alerta_joven');

  return {
    filas: [
      { titulo: 'Trabajo', valores: trabajo },
      { titulo: 'Tiempo libre', valores: tiempolibre },
      { titulo: 'Autopercepción', valores: autopercepcion },
      { titulo: 'Total adulto', valores: totalAdulto },
      { titulo: 'Total joven', valores: totalJoven },
    ],
    cruces,
    tiempoLibre: { cuenta, respuesta: q4 },
    alerta: {
      adulto: alertaAdulto,
      joven: alertaJoven,
      estiloAdulto: estiloDeAlerta(alertaAdulto),
      estiloJoven: estiloDeAlerta(alertaJoven),
    },
    autoimagen: {
      imagen: texto(adjetivos, 'imagen_elegida'),
      adjetivo: texto(adjetivos, 'adjetivo_elegido'),
    },
    emocional: {
      total: {
        pos: numero(adjetivos, 'tot_pos'),
        det: numero(adjetivos, 'tot_det'),
        neg: numero(adjetivos, 'tot_neg'),
      },
      q56: {
        pos: numero(adjetivos, 'q56_pos'),
        det: numero(adjetivos, 'q56_det'),
        neg: numero(adjetivos, 'q56_neg'),
        ponderado: texto(adjetivos, 'q56_ponderado'),
        adjetivos: texto(adjetivos, 'q56_adjetivos'),
      },
      q57: {
        pos: numero(adjetivos, 'q57_pos'),
        det: numero(adjetivos, 'q57_det'),
        neg: numero(adjetivos, 'q57_neg'),
        ponderado: texto(adjetivos, 'q57_ponderado'),
        adjetivos: texto(adjetivos, 'q57_adjetivos'),
      },
    },
    abiertas: [
      { rotulo: 'Lo que disfruta', texto: texto(abiertas, 'q21_disfruta') ?? '' },
      { rotulo: 'Lo que no disfruta', texto: texto(abiertas, 'q22_no_disfruta') ?? '' },
      { rotulo: 'Hace bien pero no le gusta', texto: texto(abiertas, 'q61_hace_bien_no_gusta') ?? '' },
    ].filter((x) => x.texto),
    estres: {
      puntos: numero(estres, 'puntos_estres'),
      eventos: eventosOcurridos(estres),
    },
  };
}
