import type { Exigencia } from '@/lib/exigencia';
import { bandasDe, colorDe, tramosDe } from '@/lib/exigencia';

/**
 * Las piezas dibujadas del informe: el color de un puntaje, el ícono de cada
 * nivel de ajuste, el velocímetro de una competencia y la escala de bandas.
 *
 * Viven acá y no adentro de `Documento` porque las usan dos presentaciones del
 * mismo informe: el documento, que es lo que se imprime y se descarga, y el
 * sitio del portal, que es como el cliente lo lee en pantalla. Dibujadas dos
 * veces se habrían separado en la primera corrección.
 */

/**
 * El color de un puntaje, aclarado contra la hoja: 1 es pleno, 0 es blanco.
 *
 * El color sale de la banda en la que cae con la exigencia de este informe, no
 * de una tabla de tramos fija: si el pedido se lee con una exigencia más baja,
 * el 30 pasa a ser Adecuado y se pinta de azul. Con los tramos escritos a mano,
 * ese mismo 30 salía naranja al lado de la palabra Adecuado.
 */
export function tono(puntaje: number | null, fuerza: number, exigencia: Exigencia): string {
  const c = colorDe(puntaje ?? 0, exigencia).map((n) =>
    Math.round(n + (255 - n) * (1 - fuerza))
  );
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * El ícono de cada nivel de ajuste.
 *
 * Dice lo mismo que el color y sirve donde el color no llega: impreso en blanco
 * y negro, y para quien no distingue el verde del rojo. Cada forma es la de su
 * significado: el tilde de lo que pasa, la admiración de lo que hay que
 * acompañar, el triángulo de lo que hay que seguir de cerca y la cruz de lo que
 * no da.
 */
export function IconoNivel({ clave }: { clave: string }) {
  const trazo = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <span className="inf-nivel-icono" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        {clave === 'alto' && <path d="M5 12.5l4.5 4.5L19 7.5" {...trazo} />}
        {clave === 'desarrollar' && <path d="M12 6v8M12 18v.01" {...trazo} />}
        {clave === 'alertas' && (
          <path d="M12 4.5L21 19H3zM12 10v4M12 16.5v.01" {...trazo} />
        )}
        {clave === 'bajo' && <path d="M7 7l10 10M17 7L7 17" {...trazo} />}
      </svg>
    </span>
  );
}

/**
 * La escala de las nueve competencias, dibujada.
 *
 * Era una línea de texto con los cuatro nombres y sus números. Dibujada dice
 * dos cosas más que ahí no estaban: de qué color es cada banda, que es lo que
 * después se ve en cada velocímetro, y cuánto ocupa cada una, porque el ancho
 * de cada tramo es el ancho real de la banda. Adecuado es el más ancho: agarra
 * treinta de los cien puntos.
 *
 * La barra lleva cinco colores y los rótulos cuatro bandas, porque Bajo se
 * dibuja partido en naranja y rojo pero se informa como una sola banda: un 5 y
 * un 30 no se leen igual y el color lo dice sin nombrarlo.
 *
 * Los cortes salen de la exigencia con la que se lee este informe, así que los
 * anchos se mueven con ella: con una exigencia más baja, Adecuado empieza antes
 * y se ve más ancho.
 */
export function EscalaBandas({ exigencia }: { exigencia: Exigencia }) {
  // Degradado continuo: cada color pleno en el centro de su tramo y la mezcla
  // entre uno y otro, así la escala se lee como un recorrido de rojo a verde y
  // no como cinco cajas. Las puntas quedan plenas hasta el borde.
  const tramos = tramosDe(exigencia).map((t, i, todos) => {
    const hasta = i === todos.length - 1 ? 100 : todos[i + 1].desde;
    const medio = i === 0 ? 0 : i === todos.length - 1 ? 100 : (t.desde + hasta) / 2;
    return `rgb(${t.rgb.join(', ')}) ${medio}%`;
  });

  const bandas = bandasDe(exigencia).slice().reverse();

  return (
    <div className="inf-escala-bandas">
      <p className="inf-escala-titulo">Escala de puntajes</p>
      <span
        className="inf-escala-barra"
        style={{ backgroundImage: `linear-gradient(90deg, ${tramos.join(', ')})` }}
      />
      {/* Las columnas en porcentaje y no en partes proporcionales: la línea que
          separa dos rótulos tiene que caer justo donde la barra cambia de
          color, y el degradado usa el corte a secas (35, 65, 90). Contando
          `hasta + 1 - desde` el ancho de cada banda salía un punto más largo, y
          las tres líneas quedaban corridas a la izquierda: al mover un corte
          desde Configuración, el desfase saltaba a la vista. */}
      <div
        className="inf-escala-rotulos"
        style={{
          gridTemplateColumns: bandas
            .map((b, i, todas) => `${(todas[i + 1]?.desde ?? 100) - b.desde}%`)
            .join(' '),
        }}
      >
        {bandas.map((b) => (
          <span key={b.nombre}>
            <em style={{ color: tono(b.hasta, 1, exigencia) }}>{b.nombre}</em>
            {b.desde === 0 ? `menos de ${exigencia.adecuado}` : `${b.desde} a ${b.hasta}`}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * El velocímetro de una competencia: un anillo con el puntaje adentro.
 *
 * Tres cosas a la vez, sin que ninguna tape a la otra. El anillo de fondo, gris,
 * es la escala entera. El arco encima llega hasta el puntaje y va del color que
 * le toca a ese puntaje: aclarado donde arranca y pleno donde termina, así el
 * final del arco es lo que más pesa. Y el número va en el centro, que es donde
 * lo busca el ojo.
 *
 * **Un solo color por velocímetro.** Antes el arco recorría las cuatro bandas y
 * empezaba siempre en rojo, así que una competencia sobresaliente mostraba un
 * cuarto de anillo en rojo antes de llegar al verde.
 *
 * Dónde empieza cada banda se marca por fuera del anillo, con una raya corta:
 * adentro tapaba el arco justo en el tramo que la persona alcanzó.
 *
 * Abre 270 grados y no 360: el hueco de abajo es el que convierte un anillo en
 * un instrumento con principio y fin, y deja lugar para la banda.
 *
 * El degradado va en segmentos y no en un `linearGradient`: un gradiente lineal
 * cruza el dibujo en línea recta y el anillo es un arco, así que los colores
 * caerían donde no va ninguno. Cada segmento es un tramo de dos puntos con el
 * color de su lugar, y con el solape no se ven las juntas.
 *
 * En SVG y no en canvas: es un dibujo de pocos trazos y tiene que sobrevivir a
 * la impresión del PDF.
 */
export function VelocimetroArco({
  puntaje,
  exigencia,
}: {
  puntaje: number | null;
  /** De dónde salen las marcas de corte que van por fuera del anillo. */
  exigencia: Exigencia;
}) {
  const CAJA = 116;
  const R = 44;
  const c = CAJA / 2;
  /** Arranca abajo a la izquierda y cierra abajo a la derecha: 270 grados. */
  const INICIO = 135;
  const BARRIDO = 270;
  const PASO = 2;

  const punto = (v: number, r: number) => {
    const a = ((INICIO + (Math.min(100, Math.max(0, v)) / 100) * BARRIDO) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };

  const arco = (desde: number, hasta: number, r = R) => {
    const [x1, y1] = punto(desde, r);
    const [x2, y2] = punto(hasta, r);
    const largo = ((hasta - desde) / 100) * BARRIDO > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largo} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  /** El arco del puntaje, en tramos que van aclarados a plenos. */
  const lleno = (hasta: number) => {
    const tramos = [];
    for (let v = 0; v < hasta; v += PASO) {
      const fin = Math.min(hasta, v + PASO);
      tramos.push(
        <path
          key={v}
          d={arco(v, fin + (fin < hasta ? 0.6 : 0))}
          stroke={tono(puntaje, 0.42 + 0.58 * (((v + fin) / 2 / hasta) ** 0.7), exigencia)}
          fill="none"
          strokeWidth="9"
          strokeLinecap={v === 0 || fin === hasta ? 'round' : 'butt'}
        />
      );
    }
    return tramos;
  };

  /** Dónde arranca cada banda menos la de abajo, que arranca en cero. */
  const cortes = bandasDe(exigencia).filter((b) => b.desde > 0);

  return (
    <div className="inf-gauge-caja">
      <svg className="inf-gauge" viewBox={`0 0 ${CAJA} ${CAJA}`} aria-hidden="true">
        {/* La escala entera. */}
        <path d={arco(0, 100)} className="inf-gauge-fondo" fill="none" strokeWidth="9" />
        {/* Dónde empieza cada banda, por fuera del anillo. */}
        {cortes.map((b) => {
          const [x1, y1] = punto(b.desde, R + 6.5);
          const [x2, y2] = punto(b.desde, R + 10);
          return (
            <line
              key={b.nombre}
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              className="inf-gauge-corte"
            />
          );
        })}
        {puntaje !== null && puntaje > 0 && lleno(puntaje)}
      </svg>
      <div className="inf-gauge-centro">
        {puntaje === null ? (
          <span className="inf-gauge-vacio">sin datos</span>
        ) : (
          <>
            <span className="inf-gauge-numero" style={{ color: tono(puntaje, 1, exigencia) }}>
              {puntaje}
            </span>
            <span className="inf-gauge-escala">de 100</span>
          </>
        )}
      </div>
    </div>
  );
}


/**
 * El velocímetro en prueba: un anillo fino y cerrado con el número adentro.
 *
 * El anillo gris da la vuelta entera y es la escala de 0 a 100. El arco de
 * color arranca abajo al medio, gira en el sentido del reloj y cubre la parte de la
 * vuelta que vale el puntaje, con las puntas redondeadas. Un solo color, el de
 * la banda, sin degradado y sin las marcas de corte por fuera: los cortes los
 * dicen el radar y la escala de bandas que acompañan.
 *
 * El número va en el color del texto y no en el de la banda, que ya lo lleva
 * el arco y la palabra de abajo.
 *
 * El anterior, abierto abajo y con degradado, quedó como `VelocimetroArco`:
 * volver es intercambiar los dos nombres.
 */
export function Velocimetro({
  puntaje,
  exigencia,
}: {
  puntaje: number | null;
  exigencia: Exigencia;
}) {
  const CAJA = 116;
  const R = 50;
  const GROSOR = 7;
  const c = CAJA / 2;
  const vuelta = 2 * Math.PI * R;
  const parte = (Math.min(100, Math.max(0, puntaje ?? 0)) / 100) * vuelta;

  return (
    <div className="inf-gauge-caja">
      <svg className="inf-gauge" viewBox={`0 0 ${CAJA} ${CAJA}`} aria-hidden="true">
        <circle cx={c} cy={c} r={R} className="inf-gauge-fondo" fill="none" strokeWidth={GROSOR} />
        {puntaje !== null && puntaje > 0 && (
          <circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            stroke={tono(puntaje, 1, exigencia)}
            strokeWidth={GROSOR}
            strokeLinecap="round"
            strokeDasharray={`${parte.toFixed(2)} ${vuelta.toFixed(2)}`}
            transform={`rotate(90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="inf-gauge-centro">
        {puntaje === null ? (
          <span className="inf-gauge-vacio">sin datos</span>
        ) : (
          <>
            <span className="inf-gauge-numero inf-gauge-numero-anillo">{puntaje}</span>
            <span className="inf-gauge-escala">de 100</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * El radar de las competencias: todas juntas en una sola figura.
 *
 * Los velocímetros dicen cuánto dio cada una; el radar dice qué forma tiene el
 * conjunto, que es lo que no se ve leyendo seis números de a uno. Un eje por
 * competencia, del centro (0) al borde (100), y el polígono une los puntajes.
 *
 * Los ejes van en el orden del informe y no de mayor a menor: ordenados, todas
 * las personas dibujarían la misma espiral y dos radares no se podrían comparar.
 *
 * Los anillos son los cortes de las bandas de este informe, los mismos que
 * marca cada velocímetro por fuera: un vértice que pasa un anillo cambió de
 * banda. Y cada vértice lleva el color de su puntaje, igual que su anillo.
 *
 * Una competencia sin puntaje conserva su eje y dice "sin datos", pero no
 * entra al polígono: llevarla al centro la dibujaría como un cero. Con menos
 * de tres puntajes no hay figura que cerrar y el radar no sale.
 */
export function RadarCompetencias({
  competencias,
  exigencia,
  medianas = null,
}: {
  competencias: { nombre: string; puntaje: number | null }[];
  exigencia: Exigencia;
  /**
   * La mediana de cada competencia entre todas las personas evaluadas.
   *
   * Va punteada y en turquesa, por debajo del perfil: dice dónde cae la mitad
   * de quienes pasaron por la misma evaluación, que es contra qué se lee si un
   * puntaje es mucho o poco. En turquesa por lo mismo que el perfil
   * adolescente del Benziger: es una referencia y no toma ninguno de los
   * colores con los que se nombran las bandas.
   */
  medianas?: { porCompetencia: Record<string, number>; casos: number } | null;
}) {
  const R = 118;
  const RENGLON = 13;
  const n = competencias.length;
  const conPuntaje = competencias.filter((c) => c.puntaje !== null).length;
  if (n < 3 || conPuntaje < 3) return null;

  /** El primer eje apunta arriba y los demás siguen en el sentido del reloj. */
  const angulo = (i: number) => ((-90 + (360 / n) * i) * Math.PI) / 180;
  const punto = (i: number, v: number, extra = 0) => {
    const largo = (Math.min(100, Math.max(0, v)) / 100) * R + extra;
    return { x: largo * Math.cos(angulo(i)), y: largo * Math.sin(angulo(i)) };
  };
  const trazar = (valor: (i: number) => number | null) =>
    competencias
      .map((_, i) => {
        const v = valor(i);
        if (v === null) return null;
        const p = punto(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  /** El nombre partido en renglones cortos: el SVG no corta el texto solo. */
  const renglones = (nombre: string) => {
    const lineas: string[] = [];
    for (const palabra of nombre.split(' ')) {
      const ultima = lineas[lineas.length - 1];
      if (ultima !== undefined && (ultima + ' ' + palabra).length <= 16) {
        lineas[lineas.length - 1] = ultima + ' ' + palabra;
      } else {
        lineas.push(palabra);
      }
    }
    return lineas;
  };

  const cortes = bandasDe(exigencia)
    .map((b) => b.desde)
    .filter((v) => v > 0);

  const mediana = (i: number) => medianas?.porCompetencia[competencias[i].nombre] ?? null;
  const conMediana = competencias.filter((_, i) => mediana(i) !== null).length;
  const hayMediana = Boolean(medianas) && conMediana >= 3;

  return (
    <>
    {hayMediana && (
      <div className="inf-referencia-perfil inf-radar-referencia">
        <span className="inf-ref adulto">Esta persona</span>
        <span className="inf-ref joven">
          Mediana de las {medianas!.casos} personas evaluadas por Campos HR
        </span>
      </div>
    )}
    <svg
      className="inf-radar"
      viewBox="-250 -185 500 370"
      role="img"
      aria-label={`Competencias evaluadas: ${competencias
        .map((c) => `${c.nombre} ${c.puntaje ?? 'sin datos'}`)
        .join(', ')}`}
    >
      <polygon points={trazar(() => 100)} className="inf-radar-borde" />
      {cortes.map((v) => (
        <polygon key={v} points={trazar(() => v)} className="inf-radar-anillo" />
      ))}
      {competencias.map((c, i) => {
        const p = punto(i, 100);
        return <line key={c.nombre} x1="0" y1="0" x2={p.x} y2={p.y} className="inf-radar-eje" />;
      })}

      {hayMediana && <polygon points={trazar(mediana)} className="inf-radar-mediana" />}
      {/* Los puntos de la mediana, plenos sobre su área: marcan en qué valor cae
          en cada eje, que sobre el borde del área sola había que adivinarlo. */}
      {hayMediana &&
        competencias.map((c, i) => {
          const v = mediana(i);
          if (v === null) return null;
          const p = punto(i, v);
          return <circle key={c.nombre} cx={p.x} cy={p.y} r="2.8" className="inf-radar-mediana-punto" />;
        })}
      <polygon points={trazar((i) => competencias[i].puntaje)} className="inf-radar-perfil" />

      {competencias.map((c, i) => {
        if (c.puntaje === null) return null;
        const p = punto(i, c.puntaje);
        return (
          <circle
            key={c.nombre}
            cx={p.x}
            cy={p.y}
            r="3.6"
            className="inf-radar-vertice"
            style={{ fill: tono(c.puntaje, 1, exigencia) }}
          />
        );
      })}

      {/* El nombre y debajo el puntaje, por fuera de la punta de cada eje. Se
          alinean hacia afuera según de qué lado cae el eje, así ninguno pisa
          la figura. */}
      {competencias.map((c, i) => {
        const p = punto(i, 100, 14);
        const cos = Math.cos(angulo(i));
        const sin = Math.sin(angulo(i));
        const lineas = renglones(c.nombre);
        const ancla = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        const alto = lineas.length * RENGLON;
        const y = sin < -0.3 ? p.y - alto : sin > 0.3 ? p.y + 10 : p.y - alto / 2 + 4;
        return (
          <text key={c.nombre} x={p.x} y={y} textAnchor={ancla} className="inf-radar-rotulo">
            {lineas.map((l, k) => (
              <tspan key={k} x={p.x} dy={k === 0 ? 0 : RENGLON}>
                {l}
              </tspan>
            ))}
            <tspan
              x={p.x}
              dy={RENGLON + 1}
              className={c.puntaje === null ? 'inf-radar-vacio' : 'inf-radar-valor'}
              style={c.puntaje === null ? undefined : { fill: tono(c.puntaje, 1, exigencia) }}
            >
              {c.puntaje ?? 'sin datos'}
            </tspan>
          </text>
        );
      })}
    </svg>
    </>
  );
}
