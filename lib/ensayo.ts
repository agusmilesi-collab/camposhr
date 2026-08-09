/**
 * El reparto del ensayo de la charla 4, donde se practica dar una mala noticia.
 *
 * Tres rondas. En cada una la sala se arma en tríos: uno comunica, uno recibe y
 * uno observa. Al terminar las tres, cada persona tiene que haber pasado por los
 * tres roles, por los tres casos y por las tres reacciones, y no haber repetido
 * ningún compañero.
 *
 * Cómo se consigue. Las personas se acomodan en una grilla de tres filas por m
 * columnas, y cada trío es una columna. En cada ronda la segunda y la tercera
 * fila se corren una cantidad distinta de columnas, así que los tríos se rearman
 * sin que dos personas se crucen dos veces. La fila define el rol y rota con la
 * ronda, así que los tres roles salen solos. El caso y la reacción los define la
 * ronda: además de garantizar que todos pasen por los tres, le da a la puesta en
 * común una comparación que de otra forma no existe, porque los que comunicaron
 * contra el enojo y los que comunicaron contra el silencio hicieron cosas
 * distintas.
 *
 * La primera fila no se mueve nunca. Un tercio de la sala se queda en su lugar y
 * el resto rota alrededor, que es lo que hace que cambiar de compañeros no
 * termine en cinco minutos de gente buscándose.
 *
 * Acá no hay nada de base de datos a propósito: es una función de una lista de
 * personas a un reparto, y por eso se puede verificar sola.
 */

export const ROLES = ['comunica', 'recibe', 'observa'] as const;
export type Rol = (typeof ROLES)[number];

/** Los tres casos que pidió el cliente, en el mismo orden que la placa 4. */
export const CASOS = [
  {
    titulo: 'Comunicar una suspensión',
    situacion:
      'Un mecánico del taller trabajó dos veces sin los elementos de ' +
      'seguridad, después de que se lo advirtieran. Son cinco días, a partir ' +
      'del miércoles.',
  },
  {
    titulo: 'Dar una devolución por un desempeño que no alcanza',
    situacion:
      'Alguien de repuestos viene entregando pedidos con el código ' +
      'equivocado desde hace tres meses. Ya se lo dijiste una vez y siguió ' +
      'igual.',
  },
  {
    titulo: 'Avisar que no hubo recategorización',
    situacion:
      'Una persona de administración la pidió hace ocho meses y vos la ' +
      'apoyaste. Quedó afuera del último ajuste y hoy te pregunta.',
  },
] as const;

/**
 * Lo que hace quien recibe la noticia. Va sólo en su teléfono: el que comunica
 * se entera cuando pasa, que es lo que hace que el ensayo sirva de algo.
 */
export const REACCIONES = [
  {
    nombre: 'Reaccionás con enojo',
    instruccion: 'No aceptás la decisión. Te parece injusta.',
    guion: [
      'Apenas termina de decirlo, subí la voz: “¿Por qué yo? A otros no les ' +
        'pasó nada”.',
      'Cruzá los brazos, dá un paso atrás y dejá de mirarlo.',
      'Cada vez que te dé una razón, cortalo: “Eso ya lo veníamos hablando y ' +
        'nadie hizo nada”.',
    ],
  },
  {
    nombre: 'Te quebrás',
    instruccion: 'No lo esperabas y no lo podés sostener.',
    guion: [
      'Cuando termina, quedate callado. Mirá para abajo tres o cuatro segundos.',
      'Después decí bajito y cortado: “Perdón… dame un segundo”.',
      'Si te apura o te llena de razones, tapate la cara y decí: “No sé qué ' +
        'le digo en mi casa”.',
    ],
  },
  {
    nombre: 'Te cerrás',
    instruccion: 'Te lo guardás todo. Por afuera no pasa nada.',
    guion: [
      'Cuando termina, no digas nada. Dejá el silencio ahí, sin ayudarlo.',
      'Si te pregunta algo, contestá “ajá” o “está bien”. Nada más largo.',
      'Quedate duro mirando la puerta. Si insiste, decí: “¿Puedo irme?”.',
    ],
  },
] as const;

export type Puesto = { asistenteId: string; rol: Rol };

export type GrupoEnsayo = {
  /** El número que se muestra en el teléfono para juntarse sin buscar nombres. */
  grupo: number;
  ronda: number;
  caso: number;
  reaccion: number;
  puestos: Puesto[];
};

/**
 * Tres corrimientos que no repiten ninguna pareja.
 *
 * Dos personas de las filas a y b quedan en el mismo trío en la ronda r cuando
 * la diferencia entre sus columnas es `s[r][a] - s[r][b]`. Para que ninguna
 * pareja se repita, esas tres diferencias tienen que ser distintas entre sí,
 * para cada uno de los tres pares de filas.
 *
 * Se busca por fuerza bruta porque no hay fórmula que sirva para todo m: la
 * obvia, correr una y dos columnas, falla con m par. Son unas pocas decenas de
 * miles de combinaciones y se calcula una sola vez por encuentro.
 */
function corrimientos(m: number): number[][] | null {
  const paresDeFilas: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  for (let a1 = 0; a1 < m; a1++) {
    for (let b1 = 0; b1 < m; b1++) {
      for (let a2 = 0; a2 < m; a2++) {
        for (let b2 = 0; b2 < m; b2++) {
          const s = [
            [0, 0, 0],
            [0, a1, b1],
            [0, a2, b2],
          ];
          const sirve = paresDeFilas.every(([x, y]) => {
            const vistas = new Set(s.map((f) => (((f[x] - f[y]) % m) + m) % m));
            return vistas.size === 3;
          });
          if (sirve) return s;
        }
      }
    }
  }
  return null;
}

/**
 * El reparto de las tres rondas.
 *
 * `ids` tiene que venir en un orden estable, por ejemplo por fecha de registro:
 * el reparto se calcula una sola vez y se guarda, y si alguna vez hubiera que
 * recalcularlo tiene que dar lo mismo. Once tríos enterándose a mitad del
 * ejercicio de que ahora tienen otros compañeros es peor que cualquier error.
 */
export function repartoEnsayo(ids: string[]): GrupoEnsayo[][] {
  const m = Math.floor(ids.length / 3);
  if (m < 3) throw new Error('el ensayo necesita al menos nueve personas');
  const s = corrimientos(m);
  if (!s) throw new Error(`no hay reparto sin repetir compañeros para ${m} tríos`);

  const grilla = [ids.slice(0, m), ids.slice(m, 2 * m), ids.slice(2 * m, 3 * m)];
  const sobran = ids.slice(3 * m);

  return [0, 1, 2].map((ronda) => {
    const grupos: GrupoEnsayo[] = [];
    for (let c = 0; c < m; c++) {
      const puestos: Puesto[] = [0, 1, 2].map((fila) => ({
        asistenteId: grilla[fila][(((c - s[ronda][fila]) % m) + m) % m],
        rol: ROLES[(fila + ronda) % 3],
      }));
      grupos.push({ grupo: c + 1, ronda, caso: ronda, reaccion: ronda, puestos });
    }

    /*
     * Cuando la cantidad no es múltiplo de tres, hay un límite que no depende
     * del reparto: con 3m+1 personas hay 3m turnos de comunicar y 3m de
     * recibir, así que alguien no comunica nunca y alguien no recibe nunca.
     *
     * Lo que sí se elige es quién lo paga. La que sobra se suma a un trío y le
     * toma el rol, y la desplazada pasa a ser el segundo observador de su
     * propio grupo. Así la que sobra hace los tres roles, y el costo lo pagan
     * dos personas distintas que pierden uno cada una, en vez de una sola que
     * observa tres veces seguidas.
     *
     * En las dos primeras rondas toma los roles que no se pueden repetir, y en
     * la tercera observa. El grupo queda con las mismas cuatro personas que si
     * simplemente se hubiera sumado, así que no aparecen parejas nuevas.
     */
    const TOMA: (Rol | null)[] = ['comunica', 'recibe', null];
    sobran.forEach((asistenteId, i) => {
      const grupo = grupos[(ronda * 2 + i * 3) % m];
      const rolQueToma = TOMA[ronda];
      if (!rolQueToma) {
        grupo.puestos.push({ asistenteId, rol: 'observa' });
        return;
      }
      const desplazada = grupo.puestos.find((p) => p.rol === rolQueToma);
      if (!desplazada) {
        grupo.puestos.push({ asistenteId, rol: 'observa' });
        return;
      }
      desplazada.rol = 'observa';
      grupo.puestos.push({ asistenteId, rol: rolQueToma });
    });
    return grupos;
  });
}
