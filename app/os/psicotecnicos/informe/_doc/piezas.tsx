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
  const tramos = tramosDe(exigencia).map((t, i, todos) => {
    const hasta = i === todos.length - 1 ? 100 : todos[i + 1].desde;
    return `rgb(${t.rgb.join(', ')}) ${t.desde}% ${hasta}%`;
  });

  const bandas = bandasDe(exigencia).slice().reverse();

  return (
    <div className="inf-escala-bandas">
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
export function Velocimetro({
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

