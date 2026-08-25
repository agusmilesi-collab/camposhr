import 'server-only';
import { fichaDe, proyectivoDe, type Ficha } from '@/lib/ficha';
import { leer, porArea, senalDe, type Lectura, type SumarioCrudo } from '@/lib/redacciones';
import { bandaDe, calcularCompetencias, type Competencia } from '@/lib/competencias';
import {
  CUADRANTES,
  nivelDeConclusion,
  tecnicas,
  type Cuadrante,
  type NivelAjuste,
} from '@/lib/informe-textos';
import { leerBenziger } from '@/lib/benziger-lectura';
import type { Cuatro } from '@/lib/benziger-perfil';

/**
 * El informe de selección, armado desde lo que está cargado.
 *
 * Sigue el esqueleto de la evaluadora: datos, semáforo, competencias, resumen,
 * recomendaciones al líder, análisis por competencia, Benziger, técnicas y
 * confidencialidad.
 *
 * **El veredicto no se calcula.** El nivel de ajuste sale de la recomendación
 * que cargó la psicóloga en su pestaña, y sin esa recomendación el informe no
 * se genera: es la firma de quien administró la prueba y ningún puntaje la
 * reemplaza.
 *
 * Lo que falta se dice que falta. Un informe al que le faltan las manchas sale
 * igual, con esa sección vacía y el aviso arriba, porque la evaluadora necesita
 * verlo para saber qué le falta cargar.
 */

export type Faltante = { que: string; donde: string };

/**
 * Quita las recomendaciones que dicen lo mismo con otras palabras.
 *
 * El esqueleto lo pide expresamente. Dos índices distintos pueden llevar a la
 * misma indicación: "marcarle qué cosas se hacen de una manera establecida" y
 * "marcarle qué cosas se necesitan hacer de una manera determinada" son la
 * misma frase para quien la lee. Se comparan las primeras palabras, que es
 * donde está el verbo y su objeto, y se conserva la primera.
 */
function sinRepetir(textos: string[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const t of textos) {
    const arranque = t
      .toLowerCase()
      .replace(/[^a-záéíóúñü ]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join(' ');
    if (vistas.has(arranque)) continue;
    vistas.add(arranque);
    salida.push(t);
  }
  return salida;
}

/** Las cuatro listas del informe que la evaluadora puede tocar. */
export const LISTAS_DEL_INFORME = [
  'recomendaciones',
  'destacadas',
  'esperadas',
  'desarrollar',
] as const;

export type ListaDelInforme = (typeof LISTAS_DEL_INFORME)[number];

export type Informe = {
  nombre: string;
  empresa: string | null;
  puesto: string | null;
  evaluadora: string | null;
  /** Mes y año de la evaluación, que es lo que se imprime. */
  cuando: string;
  bateria: string | null;
  /** El test de manchas que se administró, para las técnicas. */
  proyectivo: string | null;
  nivel: NivelAjuste | null;
  competencias: Competencia[];
  resumen: {
    /** Los párrafos del resumen, ya sean del motor o de la evaluadora. */
    parrafos: string[];
    /** Si lo escribió la evaluadora en el fundamento. */
    propio: boolean;
  };
  recomendaciones: string[];
  analisis: {
    destacadas: string[];
    esperadas: string[];
    desarrollar: string[];
  };
  /**
   * Cuáles de esas cuatro listas dejó escritas la evaluadora.
   *
   * Lo que está acá no lo armó el motor: es lo que ella ordenó, corrigió o
   * agregó, y no se recalcula aunque cambie la codificación. La pantalla lo usa
   * para avisar que esa sección está intervenida y para ofrecer volver atrás.
   */
  intervenidas: ListaDelInforme[];
  benziger: {
    preferentes: Cuadrante[];
    /** Los cuatro totales del perfil adulto, que es el que se grafica. */
    adulto: Cuatro | null;
    /** El perfil joven, que en el gráfico va punteado. */
    joven: Cuatro | null;
  } | null;
  raven: { raw: number; resultado: string } | null;
  tecnicas: string[];
  /** Lo que no estaba cargado y por eso no salió en el informe. */
  faltantes: Faltante[];
};

/** El mes y el año, que es la precisión con la que se fecha el informe. */
function mesYAnio(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const mes = d.toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Cordoba' });
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${d.getFullYear()}`;
}

/**
 * Las dos oraciones del resumen.
 *
 * La primera nombra dos o tres cosas que se destacan; si no se destaca nada, se
 * apoya en lo que dio dentro de lo esperado, que es lo que el esqueleto pide.
 * La segunda nombra lo que más le va a demandar al líder, que son las lecturas
 * a desarrollar que además traen recomendación.
 */
function armarResumen(
  lecturas: Lectura[],
  destacadas: Lectura[],
  esperadas: Lectura[],
  fundamento: string | null
): { parrafos: string[]; propio: boolean } {
  // Lo que escribió la evaluadora manda: el motor arma un resumen correcto
  // pero genérico, y ella tiene la lectura del caso. Si no escribió nada, sale
  // el generado, que es mejor que un informe sin resumen.
  const propio = (fundamento ?? '').trim();
  if (propio) {
    return {
      parrafos: propio
        .split(/\n\s*\n|\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      propio: true,
    };
  }

  const aFavor = (destacadas.length ? destacadas : esperadas).slice(0, 3);
  // Lo que le va a demandar al líder son las recomendaciones, no los índices:
  // el informe no nombra códigos, y al líder le sirve saber qué hacer.
  const pesan = sinRepetir(
    lecturas.filter((l) => senalDe(l) === 'desarrollar' && l.recomienda).map((l) => l.recomienda)
  ).slice(0, 3);

  const enumerar = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join('; ')}; y ${xs[xs.length - 1]}`;

  /** La primera frase alcanza para nombrar el aspecto: el resto lo desarrolla. */
  const enMinuscula = (t: string) => {
    const primera = t.split('. ')[0].replace(/\.$/, '');
    return primera.charAt(0).toLowerCase() + primera.slice(1);
  };

  const destaca = aFavor.length
    ? `Se destacan los siguientes aspectos: ${enumerar(aFavor.map((l) => enMinuscula(l.dice)))}.`
    : 'No se registran aspectos por encima de lo esperado en las competencias evaluadas.';

  const demanda = pesan.length
    ? `Su líder directo deberá prestar especial atención a ${enumerar(pesan.map(enMinuscula))}.`
    : 'No se registran aspectos que demanden una gestión particular de su líder directo.';

  return { parrafos: [destaca, demanda], propio: false };
}

export async function armarInforme(id: string): Promise<Informe | null> {
  const ficha = await fichaDe(id);
  if (!ficha) return null;
  return desdeFicha(ficha);
}

export function desdeFicha(f: Ficha): Informe {
  const c = f.cabecera;
  const faltantes: Faltante[] = [];

  const sumario = (f.sumario?.crudo ?? null) as SumarioCrudo | null;
  if (!sumario) faltantes.push({ que: 'El sumario del test de manchas', donde: 'la pestaña de codificación' });

  const ravenResultado = f.raven?.resultado ?? '';
  if (f.raven?.raw === null || f.raven?.raw === undefined) {
    faltantes.push({ que: 'El puntaje del Raven', donde: 'la pestaña Tests' });
  }

  const bz =
    f.benziger?.cuadrantes
      ? leerBenziger(
          f.benziger.cuadrantes,
          f.benziger.adjetivos ?? {},
          f.benziger.abiertas ?? {},
          f.benziger.estres ?? {}
        )
      : null;
  const fila = (titulo: string): Cuatro | null =>
    bz?.filas.find((x) => x.titulo === titulo)?.valores ?? null;
  if (!f.benziger?.cuadrante_preferente?.length) {
    faltantes.push({ que: 'El cuadrante preferente del Benziger', donde: 'la pestaña Benziger' });
  }
  if (!c.recomendacion) {
    faltantes.push({ que: 'La conclusión', donde: 'la pestaña Recomendación' });
  } else if (!nivelDeConclusion(c.recomendacion)) {
    faltantes.push({
      que: `La conclusión dice "${c.recomendacion}", que no corresponde a un nivel de ajuste`,
      donde: 'la pestaña Recomendación',
    });
  }

  /**
   * Lo que la evaluadora dejó escrito para alguna de las cuatro listas.
   *
   * Una clave ausente significa "usá lo calculado"; una lista vacía significa
   * "esta sección va sin ítems", que no es lo mismo. Por eso se pregunta si es
   * un arreglo y no si tiene largo.
   */
  const guardadas = (c.informe_listas ?? {}) as Partial<Record<ListaDelInforme, string[]>>;
  const elegir = (clave: ListaDelInforme, calculada: string[]): string[] => {
    const suya = guardadas[clave];
    return Array.isArray(suya) ? suya.filter((t) => typeof t === 'string') : calculada;
  };

  const lecturas = sumario ? leer(sumario, ravenResultado) : [];
  const destacadas = lecturas.filter((l) => senalDe(l) === 'destacada');
  const esperadas = lecturas.filter((l) => senalDe(l) === 'esperada');
  const desarrollar = lecturas.filter((l) => senalDe(l) === 'desarrollar');

  const adulto = fila('Total adulto');
  const competencias = sumario
    ? calcularCompetencias(
        sumario,
        { ravenPercentil: f.raven?.percentil ?? null, ravenRaw: f.raven?.raw ?? null },
        proyectivoDe(f)
      )
    : [];

  const preferentes = CUADRANTES.filter((q) =>
    (f.benziger?.cuadrante_preferente ?? []).includes(q.clave)
  );

  return {
    nombre: c.personas?.nombre ?? 'Sin nombre',
    empresa: c.pedidos?.empresas?.nombre ?? null,
    puesto: c.pedidos?.puesto ?? null,
    evaluadora: c.evaluadoras?.nombre ?? null,
    cuando: mesYAnio(c.fecha_entrevista ?? c.fecha_ingreso),
    bateria: c.pedidos?.baterias?.codigo ?? null,
    proyectivo: proyectivoDe(f),
    nivel: nivelDeConclusion(c.recomendacion),
    competencias,
    resumen: armarResumen(lecturas, destacadas, esperadas, c.recomendacion_notas),
    // El líder recibe cada recomendación una sola vez, aunque dos índices
    // distintos lleven a lo mismo.
    recomendaciones: elegir(
      'recomendaciones',
      sinRepetir(lecturas.map((l) => l.recomienda).filter(Boolean))
    ),
    analisis: {
      destacadas: elegir('destacadas', destacadas.map((l) => l.dice)),
      esperadas: elegir('esperadas', esperadas.map((l) => l.dice)),
      desarrollar: elegir('desarrollar', desarrollar.map((l) => l.dice)),
    },
    intervenidas: LISTAS_DEL_INFORME.filter((k) => Array.isArray(guardadas[k])),
    benziger: f.benziger ? { preferentes, adulto, joven: fila('Total joven') } : null,
    raven:
      f.raven?.raw !== null && f.raven?.raw !== undefined
        ? { raw: f.raven.raw, resultado: f.raven.resultado ?? '' }
        : null,
    tecnicas: tecnicas(c.pedidos?.baterias?.codigo ?? null, Boolean(f.benziger)),
    faltantes,
  };
}

export { bandaDe, porArea };
