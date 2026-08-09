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

/**
 * Los tres casos que pidió el cliente, en el mismo orden que la placa 4.
 *
 * Cada uno se cuenta distinto según el rol, y eso es lo que el teléfono puede
 * hacer y una tarjeta de papel no.
 *
 * A quien comunica le llegan los datos sueltos y no una oración: con la frase
 * ya armada la lee en voz alta, y armar cómo decirlo es justamente lo que el
 * ejercicio entrena.
 *
 * A quien recibe no le llega la decisión. Si la sabe de antemano, la escena
 * deja de parecerse a la de la oficina, donde nadie entra sabiendo.
 *
 * A quien observa le llega todo, porque su trabajo es ver si el motivo que se
 * dijo coincide con lo que pasó.
 */
export const CASOS = [
  {
    titulo: 'Comunicar una suspensión',
    /** Los datos, para que arme él la manera de decirlo. */
    ficha: [
      ['Quién', 'Un mecánico del taller.'],
      [
        'Qué pasó',
        'Lo vieron trabajando sin los elementos de seguridad, dos veces, ' +
          'después de que se lo advirtieran.',
      ],
      ['Decisión', 'Cinco días de suspensión, desde el miércoles.'],
    ],
    /** Sin la decisión: se entera cuando se la dicen, como en la oficina. */
    paraQuienRecibe: 'Sos mecánico del taller. Tu jefe te pidió cinco minutos.',
  },
  {
    titulo: 'Dar una devolución por un desempeño que no alcanza',
    ficha: [
      ['Quién', 'Alguien de repuestos.'],
      [
        'Qué pasó',
        'Entrega pedidos con el código equivocado desde hace tres meses. Ya ' +
          'se lo dijeron una vez, sin formalidad, y siguió igual.',
      ],
      [
        'Decisión',
        'Queda registrado como una devolución formal, y en un mes se revisa.',
      ],
    ],
    paraQuienRecibe:
      'Trabajás en repuestos. Tu jefe te pidió cinco minutos.',
  },
  {
    titulo: 'Avisar que no hubo recategorización',
    ficha: [
      ['Quién', 'Alguien de administración.'],
      [
        'Qué pasó',
        'Pidió la recategorización hace ocho meses y vos la apoyaste. Quedó ' +
          'afuera del último ajuste porque el presupuesto alcanzó para dos ' +
          'personas de todo el sector.',
      ],
      ['Decisión', 'Este año no hay recategorización para esa persona.'],
    ],
    paraQuienRecibe:
      'Trabajás en administración. Hace ocho meses pediste la ' +
      'recategorización. Tu jefe te pidió cinco minutos.',
  },
] as const;

/**
 * Lo que hace quien recibe la noticia. Va sólo en su teléfono: el que comunica
 * se entera cuando pasa, que es lo que hace que el ensayo sirva de algo.
 *
 * Están escritas como acciones y no como estados. A alguien a quien le piden
 * que actúe delante de dos compañeros, "te cerrás" no le dice qué hacer con el
 * cuerpo ni qué decir. Cada línea es un momento, una frase textual y un
 * movimiento.
 *
 * **Van apareadas con los casos, en el mismo orden.** El reparto le da a cada
 * ronda su caso y su reacción, y los dos salen del número de ronda, así que la
 * primera reacción cae siempre con el primer caso. Por eso las frases pueden
 * nombrar la situación: el enojo es siempre por la suspensión.
 *
 * El disparador es que le hayan dicho la decisión, no que el otro haya dejado
 * de hablar. Si da vueltas y nunca la dice, no hay noticia a la que reaccionar.
 */
export const REACCIONES = [
  {
    nombre: 'Te enojás',
    instruccion: 'Estás enojado y te parece injusto que te suspendan a vos.',
    guion: [
      'Cuando te dice la sanción, subí la voz: “¿Por qué yo? A otros los ' +
        'vi trabajando igual y nadie les dijo nada”.',
      'Cruzá los brazos, dá un paso atrás y mirá para otro lado.',
      'Cada vez que te dé una razón, interrumpilo: “Eso ya lo veníamos ' +
        'hablando y nadie hizo nada”.',
    ],
  },
  {
    nombre: 'Llorás',
    instruccion: 'Se te llenan los ojos de lágrimas y te cuesta hablar.',
    guion: [
      'Cuando te dice que tu trabajo no está bien, quedate callado y mirá ' +
        'para abajo tres o cuatro segundos.',
      'Después hablá en voz baja y cortada: “Perdón… dame un segundo”.',
      'Si te apura o te sigue dando explicaciones, tapate la cara con una ' +
        'mano y decí: “Hace tres meses que vengo pidiendo que me expliquen ' +
        'bien el sistema”.',
    ],
  },
  {
    nombre: 'No decís nada',
    instruccion: 'Contestás lo mínimo y querés terminar la conversación.',
    guion: [
      'Cuando te dice que este año no hay, quedate callado, ' +
        'aunque el silencio se haga largo.',
      'Si te pregunta algo, contestá “ajá” o “está bien”, y nada más.',
      'Quedate quieto, con las manos a los costados, mirando la puerta. Si ' +
        'insiste, decí: “¿Puedo irme?”.',
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
