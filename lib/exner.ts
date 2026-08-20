/**
 * MOTOR EXNER v7 — perfiles Rorschach / Zulliger.
 *
 * Es el mismo motor que corría como automatización dentro de Airtable, traído
 * al repositorio sin tocarle el cálculo: mismas fórmulas, mismos umbrales,
 * mismas comparaciones null-safe, mismo formateo. Lo único que se quitó es el
 * envoltorio que leía y escribía en Airtable; de eso se encarga ahora
 * `app/api/os/sumario/route.ts`, que lee de `rorschach_respuestas` y guarda en
 * `sumario_exner`.
 *
 *   · Rorschach → Sistema Comprehensivo de Exner, 10 láminas (manual Sendín)
 *   · Zulliger  → adaptación argentina de Angélica L. Zdunic, 3 láminas
 *
 * PRINCIPIO: lo que no corresponde a un test devuelve `null`, nunca 0. Un 0 se
 * lee como "negativo, todo bien". Este JSON alimenta al agente que redacta el
 * informe, así que la diferencia importa.
 *
 * No editar el cálculo a mano sin volver sobre el original: los umbrales están
 * calibrados contra los manuales y varios criterios dependen de que un valor
 * ausente NO cumpla la condición.
 */

export type Respuesta = {
  lam: string;
  n_rta: number;
  loc: string;
  n_loc: string | null;
  determinantes: string[];
  fq: string;
  par: boolean;
  contenidos: string[];
  popular: boolean;
  z: number | null;
  ccee: string[];
  agc: boolean;
  sl: boolean;
};

type Perfil = {
  nombre: string;
  normas: string;
  laminas: string[];
  globalTag: string;
  zest: Record<number, number | null> | null;
  usaZ: boolean;
  afr: { cromaticas: string[]; acromaticas: string[] } | null;
  convierteD: boolean;
  muestraEBPer: boolean;
  muestraCP: boolean;
  csBlends: string;
  constelaciones: string[];
  layout: string;
};

// ============================================================
//  HELPERS
// ============================================================

function trunc2(x: number | null): number | null {
  // Trunca a 2 decimales sin redondear (convención de Lorena Campos).
  if (x === null || x === undefined) return null;
  if (x >= 0) return Math.floor(x * 100) / 100;
  return Math.ceil(x * 100) / 100;
}

/**
 * Comparaciones null-safe. IMPRESCINDIBLES.
 * En JS `null < 0.46` es true (null se coerce a 0), así que un criterio escrito
 * como `(Afr < 0.46)` dispara siempre cuando Afr no se pudo calcular.
 * Regla: un valor ausente NO cumple el criterio.
 */
function lt(x: number | null, umbral: number) { return (x === null || x === undefined) ? false : x < umbral; }
function gt(x: number | null, umbral: number) { return (x === null || x === undefined) ? false : x > umbral; }
function absGt(x: number | null, umbral: number) { return (x === null || x === undefined) ? false : Math.abs(x) > umbral; }

// Tabla Zest oficial Exner por Zf — manual Sendín, hasta Zf=50. SOLO Rorschach.
const ZEST_RORSCHACH: Record<number, number | null> = {
  1: null, 2: 2.5, 3: 6.0, 4: 10.0, 5: 13.5, 6: 17.0, 7: 20.5, 8: 24.0,
  9: 27.5, 10: 31.0, 11: 34.5, 12: 38.0, 13: 41.5, 14: 45.5, 15: 49.0,
  16: 52.5, 17: 56.0, 18: 59.5, 19: 63.0, 20: 66.5, 21: 70.0, 22: 73.5,
  23: 77.0, 24: 81.0, 25: 84.5, 26: 88.0, 27: 91.5, 28: 95.0, 29: 98.5,
  30: 102.5, 31: 105.5, 32: 109.5, 33: 112.5, 34: 116.5, 35: 120.0,
  36: 123.5, 37: 127.0, 38: 130.5, 39: 134.0, 40: 137.5, 41: 141.0,
  42: 144.5, 43: 148.0, 44: 152.0, 45: 155.5, 46: 159.0, 47: 162.5,
  48: 166.0, 49: 169.5, 50: 173.0,
};

// ============================================================
//  PERFILES POR TEST
// ============================================================
/**
 * ZULLIGER — verificado contra la hoja de sumario estructural de Zdunic:
 *   · Localización es W / D / W+D / Dd / S — usa W, NO G
 *   · Controles trae solo "EA − es": no hay D, ni Adj D, ni Adj es, ni EBPer
 *   · Afectos no tiene Afr ni CP
 *   · Procesamiento no tiene ninguna línea Z, y la grilla de codificación no
 *     tiene columna de Pje Z: la dimensión Z no existe en el test
 *   · No hay bloque de constelaciones
 *   · Calidad Formal se desglosa en 3 columnas: FQx, MQ y W+D
 *   · SL (síndrome del ladrón) se tilda por respuesta y va como marcador
 */
export const PERFILES: Record<string, Perfil> = {
  Rorschach: {
    nombre: 'Rorschach',
    normas: 'Exner Comprehensive System — 10 láminas (Sendín)',
    laminas: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'],
    globalTag: 'W',
    zest: ZEST_RORSCHACH,
    usaZ: true,
    afr: {
      cromaticas: ['VIII', 'IX', 'X'],
      acromaticas: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
    },
    convierteD: true,
    muestraEBPer: true,
    muestraCP: true,
    csBlends: 'visible',
    constelaciones: ['SCON', 'DEPI', 'CDI', 'HVI', 'OBS', 'PTI'],
    layout: 'exner',
  },
  Zulliger: {
    nombre: 'Zulliger',
    normas: 'Zdunic — adaptación argentina (Paidós, 1999)',
    laminas: ['Z1', 'Z2', 'Z3'],
    globalTag: 'W',
    zest: null,
    usaZ: false,
    afr: null,
    convierteD: false,
    muestraEBPer: false,
    muestraCP: false,
    csBlends: 'solo_json',
    constelaciones: [],
    layout: 'zdunic',
  },
};

function counter(items: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const it of items) c[it] = (c[it] || 0) + 1;
  return c;
}
function cget(c: Record<string, number>, k: string) { return c[k] || 0; }

/**
 * Base de localización. Devuelve "G" | "W" | "D" | "Dd" | "?".
 * No cae a "W" por default: un código no reconocido devuelve "?" y se reporta,
 * en lugar de contarse silenciosamente como respuesta global.
 * Ojo con el orden: "Dd" antes de "D".
 */
function locBase(loc: string | null): string {
  if (!loc) return '?';
  if (loc.startsWith('Dd')) return 'Dd';
  if (loc.startsWith('D')) return 'D';
  if (loc.startsWith('G')) return 'G';
  if (loc.startsWith('W')) return 'W';
  return '?';
}

function tieneS(loc: string | null) { return !!loc && loc.includes('S'); }

/**
 * Calidad evolutiva (DQ). Devuelve "+" | "v/+" | "v" | "o".
 * "v/+" es categoría propia, tanto en Exner como en la hoja de Zdunic.
 */
function dq(loc: string | null): string {
  if (!loc) return 'o';
  if (loc.endsWith('v/+')) return 'v/+';
  if (loc.endsWith('+')) return '+';
  if (/v$/i.test(loc)) return 'v';
  return 'o';
}

function tallyFQ(rs: Respuesta[]) {
  const c = counter(rs.map((r) => r.fq));
  return {
    mas: cget(c, '+'), o: cget(c, 'o'), u: cget(c, 'u'),
    menos: cget(c, '-'), sin: cget(c, 'none'),
    total: rs.length,
  };
}

function esM(r: Respuesta) { return r.determinantes.some((d) => d === 'Ma' || d === 'Mp'); }

function dScore(diff: number): number {
  if (diff >= -2.5 && diff <= 2.5) return 0;
  if (diff > 0) {
    if (diff <= 5.0) return 1;
    if (diff <= 7.5) return 2;
    if (diff <= 10.0) return 3;
    if (diff <= 12.5) return 4;
    return 5;
  }
  if (diff >= -5.0) return -1;
  if (diff >= -7.5) return -2;
  if (diff >= -10.0) return -3;
  if (diff >= -12.5) return -4;
  return -5;
}

// ============================================================
//  CÁLCULO DEL SUMARIO ESTRUCTURAL
// ============================================================

export function calcularSumario(respuestas: Respuesta[], perfil: Perfil): any {
  if (!perfil) throw new Error('calcularSumario requiere un perfil (PERFILES.Rorschach | PERFILES.Zulliger)');

  const R = respuestas.length;
  const noCalculado: string[] = [];
  const soloJSON: string[] = [];
  const avisos: string[] = [];

  const GLOBAL = perfil.globalTag;
  const constActivas = new Set(perfil.constelaciones || []);

  // ---- validación de codificación ----
  const locsRaras = respuestas.filter((r) => locBase(r.loc) === '?');
  if (locsRaras.length > 0) {
    avisos.push(
      `${locsRaras.length} respuesta(s) con Loc.+DQ no reconocida: ` +
      locsRaras.map((r) => `#${r.n_rta}="${r.loc}"`).join(', ')
    );
  }
  const laminasRaras = respuestas.filter((r) => !perfil.laminas.includes(r.lam));
  if (laminasRaras.length > 0) {
    avisos.push(
      `${laminasRaras.length} respuesta(s) con lámina fuera del perfil ${perfil.nombre}: ` +
      laminasRaras.map((r) => `#${r.n_rta}="${r.lam}"`).join(', ')
    );
  }
  if (!perfil.usaZ) {
    const conZ = respuestas.filter((r) => r.z !== null && r.z !== undefined);
    if (conZ.length > 0) {
      avisos.push(
        `${conZ.length} respuesta(s) tienen Pje Z cargado, pero ${perfil.nombre} no usa puntaje Z. ` +
        `Se ignoran: ` + conZ.map((r) => `#${r.n_rta}`).join(', ')
      );
    }
  }

  // ---- determinantes ----
  const detList: string[] = [];
  for (const r of respuestas) for (const d of r.determinantes) detList.push(d);
  const det = counter(detList);

  const F_puros = respuestas.filter(
    (r) => r.determinantes.length === 1 && r.determinantes[0] === 'F'
  ).length;
  const Lambda = (R - F_puros) > 0 ? trunc2(F_puros / (R - F_puros)) : null;

  const Ma = cget(det, 'Ma'), Mp = cget(det, 'Mp'), M = Ma + Mp;
  const FMa = cget(det, 'FMa'), FMp = cget(det, 'FMp'), FM = FMa + FMp;
  const ma = cget(det, 'ma'), mp = cget(det, 'mp'), m_total = ma + mp;

  const FC = cget(det, 'FC'), CF = cget(det, 'CF'), C_puro = cget(det, 'C');
  // Cn (color naming) se cuenta y se reporta, pero NO entra en SumPondC:
  // Exner lo excluye de la ponderación.
  const Cn = cget(det, 'Cn');
  const WSumC = 0.5 * FC + 1.0 * CF + 1.5 * C_puro;

  const FC_p = cget(det, "FC'"), C_pF = cget(det, "C'F"), C_p_puro = cget(det, "C'");
  const SumC_p = FC_p + C_pF + C_p_puro;

  const FT = cget(det, 'FT'), TF = cget(det, 'TF'), T_puro = cget(det, 'T');
  const SumT = FT + TF + T_puro;

  const FV = cget(det, 'FV'), VF = cget(det, 'VF'), V_puro = cget(det, 'V');
  const SumV = FV + VF + V_puro;

  const FY = cget(det, 'FY'), YF = cget(det, 'YF'), Y_puro = cget(det, 'Y');
  const SumY = FY + YF + Y_puro;

  const FD = cget(det, 'FD');
  const Fr = cget(det, 'Fr'), rF = cget(det, 'rF');

  // ---- EA / es / diferencia / D / AdjD ----
  const EA = M + WSumC;
  const es = FM + m_total + SumC_p + SumT + SumV + SumY;
  const Adj_es_raw = es - Math.max(0, m_total - 1) - Math.max(0, SumY - 1);
  const dif_EA_es = trunc2(EA - es);

  let D: number | null = null, AdjD: number | null = null;
  let Adj_es: number | null = null, dif_EA_Adjes: number | null = null;
  if (perfil.convierteD) {
    D = dScore(EA - es);
    Adj_es = Adj_es_raw;
    dif_EA_Adjes = trunc2(EA - Adj_es_raw);
    AdjD = dScore(EA - Adj_es_raw);
  } else {
    noCalculado.push(`D / Adj D / Adj es (no existen en ${perfil.nombre}: el sumario reporta la diferencia EA−es directa, sin conversión a puntaje)`);
  }

  // ---- EB / EBPer / Estilo ----
  const EB = `${M}:${WSumC.toFixed(1)}`;
  const diff_M_C = Math.abs(M - WSumC);
  let EBPer: number | null = null;
  if (perfil.muestraEBPer) {
    if (M === 0 || WSumC === 0) {
      EBPer = null;
    } else if ((EA <= 10 && diff_M_C >= 2) || (EA > 10 && diff_M_C >= 2.5)) {
      EBPer = Math.max(M, WSumC) / Math.min(M, WSumC);
    }
  } else {
    noCalculado.push(`EBPer (no está en el sumario de ${perfil.nombre})`);
  }
  const umbral_estilo = EA <= 10 ? 2.0 : 2.5;
  let estilo: string;
  if (diff_M_C <= umbral_estilo) estilo = 'Ambigual';
  else if (M > WSumC) estilo = 'Introversivo';
  else estilo = 'Extratensivo';

  // ---- Afr ----
  let Afr: number | null = null;
  if (perfil.afr) {
    const crom = respuestas.filter((r) => perfil.afr!.cromaticas.includes(r.lam)).length;
    const acrom = respuestas.filter((r) => perfil.afr!.acromaticas.includes(r.lam)).length;
    Afr = acrom > 0 ? trunc2(crom / acrom) : null;
    if (Afr === null) noCalculado.push('Afr (sin respuestas en láminas acromáticas)');
  } else {
    noCalculado.push(`Afr (no existe en ${perfil.nombre}: con 3 láminas no hay partición cromática/acromática equivalente)`);
  }

  // ---- S / Mezclas ----
  const S = respuestas.filter((r) => tieneS(r.loc)).length;
  const Blends = respuestas.filter((r) => r.determinantes.length >= 2).length;

  const colorChrom = new Set(['FC', 'CF', 'C']);
  const shading = new Set(['FT', 'TF', 'T', 'FV', 'VF', 'V', 'FY', 'YF', 'Y', "FC'", "C'F", "C'"]);
  function esColorShadingBlend(r: Respuesta) {
    if (r.determinantes.length < 2) return false;
    return r.determinantes.some((d) => colorChrom.has(d)) &&
           r.determinantes.some((d) => shading.has(d));
  }
  const CS_Blends = respuestas.filter(esColorShadingBlend).length;
  if (perfil.csBlends === 'solo_json') {
    soloJSON.push(
      `Mezclas color-sombreado = ${CS_Blends}. Se calcula pero no se muestra: no está en la hoja de ` +
      `${perfil.nombre} de Zdunic. En Rorschach alimenta S-CON y DEPI; acá no alimenta nada, y su ` +
      `umbral (>0) se calibró sobre protocolos de ~22 respuestas. Valor descriptivo, NO interpretar ` +
      `con umbrales de Rorschach.`
    );
  }

  // ---- Calidad Formal: FQx / MQ / W+D ----
  const fqx = tallyFQ(respuestas);
  const mq = tallyFQ(respuestas.filter(esM));
  const esGlobalOD = (r: Respuesta) => [GLOBAL, 'D'].includes(locBase(r.loc));
  const wdRs = respuestas.filter(esGlobalOD);
  const wd = tallyFQ(wdRs);

  const X_mas_pct = R > 0 ? trunc2((fqx.mas + fqx.o) / R) : null;
  const Xu_pct = R > 0 ? trunc2(fqx.u / R) : null;
  const X_menos_pct = R > 0 ? trunc2(fqx.menos / R) : null;
  const XA_pct = R > 0 ? trunc2((fqx.mas + fqx.o + fqx.u) / R) : null;
  // FIX v7: numerador sin FQsin, consistente con XA%.
  const WDA_pct = wd.total > 0 ? trunc2((wd.mas + wd.o + wd.u) / wd.total) : null;

  const S_menos = respuestas.filter((r) => tieneS(r.loc) && r.fq === '-').length;
  const M_menos = respuestas.filter((r) => esM(r) && r.fq === '-').length;

  // ---- Z / Procesamiento ----
  let Zf: number | null = null, ZSum: number | null = null;
  let Zest: number | null = null, Zd: number | null = null;
  if (perfil.usaZ) {
    const z_vals = respuestas.filter((r) => r.z !== null && r.z !== undefined).map((r) => r.z as number);
    Zf = z_vals.length;
    ZSum = trunc2(z_vals.reduce((a, b) => a + b, 0));
    Zest = Object.prototype.hasOwnProperty.call(perfil.zest as object, Zf) ? (perfil.zest as any)[Zf] : null;
    Zd = (Zest === null || Zest === undefined) ? null : trunc2((ZSum as number) - Zest);
    if (Zd === null) noCalculado.push(`Zd (Zf=${Zf} fuera de la tabla Zest)`);
  } else {
    noCalculado.push(`Zf / SumZ / Zest / Zd (la dimensión Z no existe en ${perfil.nombre}: la grilla de codificación no tiene columna de Pje Z)`);
  }

  const dqc = counter(respuestas.map((r) => dq(r.loc)));
  const DQ_mas = cget(dqc, '+'), DQ_v_mas = cget(dqc, 'v/+'), DQo = cget(dqc, 'o'), DQv = cget(dqc, 'v');

  const global_count = respuestas.filter((r) => locBase(r.loc) === GLOBAL).length;
  const D_count = respuestas.filter((r) => locBase(r.loc) === 'D').length;
  const Dd_count = respuestas.filter((r) => locBase(r.loc) === 'Dd').length;
  const WD_count = wd.total;

  // La lista de populares es distinta por test y por lámina. El motor solo
  // cuenta el checkbox; la tabla de referencia la aplica la evaluadora.
  const P = respuestas.filter((r) => r.popular).length;

  // ---- Activo/Pasivo ----
  const a_total = Ma + FMa + ma;
  const p_total = Mp + FMp + mp;

  // ---- Códigos especiales y contenidos ----
  const ceList: string[] = [];
  for (const r of respuestas) for (const c of r.ccee) ceList.push(c);
  const cc = counter(ceList);

  const contList: string[] = [];
  for (const r of respuestas) for (const c of r.contenidos) contList.push(c);
  const cont = counter(contList);

  const AB = cget(cc, 'AB');
  const Art = cget(cont, 'Art');
  const Ay = cget(cont, 'Ay');
  const Intelectualizacion = 2 * AB + Art + Ay;

  const pesos_lvl1: Record<string, number> = { DV: 1, INCOM: 2, DR: 3, FABCOM: 4, ALOG: 5, CONTAM: 7 };
  const pesos_lvl2: Record<string, number> = { DV2: 2, INCOM2: 4, DR2: 6, FABCOM2: 7 };
  let Sum6_lvl1 = 0, Sum6_lvl2 = 0, WSum6 = 0;
  for (const key in pesos_lvl1) { Sum6_lvl1 += cget(cc, key); WSum6 += cget(cc, key) * pesos_lvl1[key]; }
  for (const key in pesos_lvl2) { Sum6_lvl2 += cget(cc, key); WSum6 += cget(cc, key) * pesos_lvl2[key]; }
  const Sum6 = Sum6_lvl1 + Sum6_lvl2;

  const COP = cget(cc, 'COP'), AG = cget(cc, 'AG'), GHR = cget(cc, 'GHR'), PHR = cget(cc, 'PHR');
  const PER = cget(cc, 'PER'), PSV = cget(cc, 'PSV'), MOR = cget(cc, 'MOR');

  let CP: number | null = null;
  if (perfil.muestraCP) CP = cget(cc, 'CP');
  else noCalculado.push(`CP (no está en el sumario de ${perfil.nombre})`);

  // Marcadores por respuesta (columnas propias de la grilla)
  const AgC = respuestas.filter((r) => r.agc).length;
  const SL = respuestas.filter((r) => r.sl).length;

  // ---- Aislamiento ----
  const Bt = cget(cont, 'Bt'), Cl = cget(cont, 'Cl'), Ge = cget(cont, 'Ge'),
        Ls = cget(cont, 'Ls'), Na = cget(cont, 'Na');
  const Aislamiento = R > 0 ? trunc2((Bt + 2 * Cl + Ge + Ls + 2 * Na) / R) : null;

  // ---- Ego ----
  const Pares = respuestas.filter((r) => r.par).length;
  const Ego = R > 0 ? trunc2((3 * (Fr + rF) + Pares) / R) : null;

  // ---- H y derivados ----
  const H_pura = cget(cont, 'H');
  const H_paren = cget(cont, '(H)');
  const Hd = cget(cont, 'Hd');
  const Hd_paren = cget(cont, '(Hd)');
  const Hx = cget(cont, 'Hx');
  const Fd_count = cget(cont, 'Fd');
  const A_count = cget(cont, 'A');
  const A_paren = cget(cont, '(A)');
  const Ad_count = cget(cont, 'Ad');
  const Ad_paren = cget(cont, '(Ad)');
  const An_count = cget(cont, 'An');
  const Xy_count = cget(cont, 'Xy');
  const Cg_count = cget(cont, 'Cg');

  // ============================================================
  //  CONSTELACIONES — gateadas por perfil. Comparaciones null-safe.
  // ============================================================

  let SCON_obj: any = null;
  if (constActivas.has('SCON')) {
    const crit: Record<string, boolean> = {
      '1. FV+VF+V+FD > 2': (FV + VF + V_puro + FD) > 2,
      '2. Mezclas color-sombreado > 0': CS_Blends > 0,
      '3. Ego < 0.31 o > 0.44': lt(Ego, 0.31) || gt(Ego, 0.44),
      '4. MOR > 3': MOR > 3,
      '5. |Zd| > 3.5': absGt(Zd, 3.5),
      '6. es > EA': es > EA,
      '7. CF+C > FC': (CF + C_puro) > FC,
      '8. X+% < 0.70': lt(X_mas_pct, 0.70),
      '9. S > 3': S > 3,
      '10. P < 3 o > 8': P < 3 || P > 8,
      '11. H puras < 2': H_pura < 2,
      '12. R < 17': R < 17,
    };
    const val = Object.values(crit).filter(Boolean).length;
    SCON_obj = { valor: val, umbral: 8, positivo: val >= 8, criterios: crit };
  }

  let DEPI_obj: any = null;
  if (constActivas.has('DEPI')) {
    const crit: Record<string, boolean> = {
      '1. (FV+VF+V > 0) ó (FD > 2)': (FV + VF + V_puro > 0) || (FD > 2),
      '2. (Mezclas color-sombreado > 0) ó (S > 2)': (CS_Blends > 0) || (S > 2),
      '3. (Ego > 0.44 sin reflejos) ó (Ego < 0.33)':
        (gt(Ego, 0.44) && (Fr + rF) === 0) || lt(Ego, 0.33),
      '4. (Afr < 0.46) ó (Mezclas < 4)': lt(Afr, 0.46) || (Blends < 4),
      "5. (SumSombreado > FM+m) ó (SumC' > 2)":
        ((SumT + SumV + SumY + SumC_p) > (FM + m_total)) || (SumC_p > 2),
      '6. (MOR > 2) ó (Intelectualización > 3)': (MOR > 2) || (Intelectualizacion > 3),
      '7. (COP < 2) ó (Aislamiento > 0.24)': (COP < 2) || gt(Aislamiento, 0.24),
    };
    const val = Object.values(crit).filter(Boolean).length;
    DEPI_obj = { valor: val, umbral: 5, positivo: val >= 5, criterios: crit };
  }

  let CDI_obj: any = null;
  if (constActivas.has('CDI')) {
    const crit: Record<string, boolean> = {
      '1. EA<6 ó AdjD<0': EA < 6 || lt(AdjD, 0),
      '2. COP<2 y AG<2': COP < 2 && AG < 2,
      '3. SumPondC<2.5 ó Afr<.46': WSumC < 2.5 || lt(Afr, 0.46),
      '4. p > a+1 ó H pura < 2': p_total > (a_total + 1) || H_pura < 2,
      '5. SumT>1 ó Aislamiento>0.24 ó Fd>0': SumT > 1 || gt(Aislamiento, 0.24) || Fd_count > 0,
    };
    const val = Object.values(crit).filter(Boolean).length;
    CDI_obj = { valor: val, umbral: 4, positivo: val >= 4, criterios: crit };
  }

  let HVI_obj: any = null;
  if (constActivas.has('HVI')) {
    const principal = SumT === 0;
    const Hd_plus_Ad = Hd + Ad_count;
    const crit: Record<string, boolean> = {
      'Zf > 12': gt(Zf, 12),
      'Zd > +3.5': gt(Zd, 3.5),
      'S > 3': S > 3,
      'H+(H)+Hd+(Hd) > 6': (H_pura + H_paren + Hd + Hd_paren) > 6,
      '(H)+(A)+(Hd)+(Ad) > 3': (H_paren + A_paren + Hd_paren + Ad_paren) > 3,
      'H+A : Hd+Ad < 4:1': Hd_plus_Ad === 0 ? false : (H_pura + A_count) < 4 * Hd_plus_Ad,
      'Cg > 3': Cg_count > 3,
    };
    const subs = Object.values(crit).filter(Boolean).length;
    HVI_obj = {
      principal_cumple: principal, sub_cumplidos: subs,
      positivo: principal && subs >= 4, criterios: crit,
    };
  }

  let OBS_obj: any = null;
  if (constActivas.has('OBS')) {
    const crit: Record<string, boolean> = {
      '1. Dd > 3': Dd_count > 3,
      '2. Zf > 12': gt(Zf, 12),
      '3. Zd > +3.0': gt(Zd, 3.0),
      '4. P > 7': P > 7,
      '5. FQ+ > 1': fqx.mas > 1,
    };
    const cumplidos = Object.values(crit).filter(Boolean).length;
    const cumplidos_1a4 = Object.entries(crit).filter(([key, val]) => val && !key.startsWith('5')).length;
    const A = cumplidos === 5;
    const B = cumplidos_1a4 >= 2 && fqx.mas > 3;
    const C = cumplidos >= 3 && gt(X_mas_pct, 0.89);
    const Dp = fqx.mas > 3 && gt(X_mas_pct, 0.89);
    OBS_obj = {
      positivo: A || B || C || Dp,
      path: A ? 'A (todos 1-5)' : B ? 'B (≥2 de 1-4 + FQ+>3)'
          : C ? 'C (≥3 de 1-5 + X+%>.89)' : Dp ? 'D (FQ+>3 + X+%>.89)' : 'ninguno',
      criterios: crit,
    };
  }

  let PTI_obj: any = null;
  if (constActivas.has('PTI')) {
    const crit: Record<string, boolean> = {
      '1. XA%<.70 y WDA%<.75': lt(XA_pct, 0.70) && lt(WDA_pct, 0.75),
      '2. X-% > .29': gt(X_menos_pct, 0.29),
      '3. Niv.2>2 y FAB2>0': Sum6_lvl2 > 2 && cget(cc, 'FABCOM2') > 0,
      '4. (R<17 y SumPond6>12) o (R≥17 y SumPond6>17)':
        (R < 17 && WSum6 > 12) || (R >= 17 && WSum6 > 17),
      '5. M->1 o X-%>.40': M_menos > 1 || gt(X_menos_pct, 0.40),
    };
    const val = Object.values(crit).filter(Boolean).length;
    PTI_obj = { valor: val, umbral: 4, positivo: val >= 4, criterios: crit };
  }

  if (constActivas.size === 0) {
    noCalculado.push(
      `Constelaciones (S-CON, DEPI, CDI, HVI, OBS, PTI): no existen en ${perfil.nombre}. ` +
      `Sus umbrales se derivaron sobre protocolos de 10 láminas con R medio ~22; varios criterios ` +
      `se cumplirían por construcción (ej. S-CON 12 es "R < 17"). No interpretar por analogía.`
    );
  }

  // ============================================================
  //  ENSAMBLADO
  // ============================================================
  return {
    meta: {
      test: perfil.nombre,
      normas: perfil.normas,
      layout: perfil.layout,
      global_tag: GLOBAL,
      // Para el agente que redacta el informe: NO interpretar nada de estas listas.
      no_calculado: noCalculado,
      solo_json: soloJSON,
      avisos_codificacion: avisos,
    },
    cabecera: { R, F_puros, Lambda },
    localizacion: {
      global: global_count, D: D_count, WD: WD_count, Dd: Dd_count, S,
      DQ_mas, DQ_v_mas, DQo, DQv,
    },
    control_estres: {
      EB, EA, EBPer, estilo,
      eb: `${FM + m_total}:${SumC_p + SumT + SumV + SumY}`,
      es, dif_EA_es, Adj_es, dif_EA_Adjes, D, AdjD,
    },
    determinantes: {
      M, Ma, Mp, FM, FMa, FMp, m: m_total, ma, mp,
      FC, CF, C: C_puro, Cn, WSumC,
      FC_prima: FC_p, C_primaF: C_pF, C_prima: C_p_puro, SumC_prima: SumC_p,
      FT, TF, T: T_puro, SumT,
      FV, VF, V: V_puro, SumV,
      FY, YF, Y: Y_puro, SumY,
      Fr, rF, FD, F_puros,
    },
    calidad_formal: {
      FQx: fqx, MQ: mq, WD: wd,
      XA_pct, WDA_pct, X_mas_pct, Xu_pct, X_menos_pct,
      M_menos, MQ_sin: mq.sin, S_menos, P,
    },
    procesamiento: {
      Zf, ZSum, Zest, Zd,
      global: global_count, D: D_count, Dd: Dd_count,
      DQ_mas, DQ_v_mas, DQo, DQv, Blends, CS_Blends, P, PSV,
    },
    ideacion: {
      a: a_total, p: p_total, Ma, Mp,
      Intelectualizacion, MOR,
      Sum6, Sum6_lvl1, Sum6_lvl2, WSum6, M_menos, MQ_sin: mq.sin,
    },
    afectos: {
      FC, CF, C_puro, Cn, CP, SumC_prima: SumC_p, WSumC, Afr, S, Blends, CS_Blends,
    },
    interpersonal: {
      COP, AG, AgC, GHR, PHR, a: a_total, p: p_total, Fd: Fd_count, SumT,
      contenidos_humanos: H_pura + H_paren + Hd + Hd_paren + Hx,
      H_pura, PER, Aislamiento,
    },
    autopercepcion: {
      Ego, Pares, Fr, rF, Fr_plus_rF: Fr + rF, SumV, FD,
      An_plus_Xy: An_count + Xy_count, MOR,
      H_pura, H_paren, Hd, Hd_paren,
    },
    marcadores: { AgC, SL },
    constelaciones: {
      SCON: SCON_obj, DEPI: DEPI_obj, CDI: CDI_obj,
      HVI: HVI_obj, OBS: OBS_obj, PTI: PTI_obj,
    },
  };
}

// ============================================================
//  FORMATEADORES
// ============================================================
// t2: TRUNCA a 2 decimales. NUNCA redondear: los valores se leen contra
// umbrales y no deben mostrarse por encima de lo que realmente son.
// Ej: 0.799 se muestra 0.79, no 0.80.
function t2(x: any) {
  if (x === null || x === undefined) return '—';
  const t = Math.trunc(Number(x) * 100) / 100;
  return t.toFixed(2);
}
function n0(x: any) { return (x === null || x === undefined) ? '—' : String(x); }
function sg(x: any) {
  if (x === null || x === undefined) return '—';
  return (Number(x) >= 0 ? '+' : '') + x;
}
function chk(b: boolean) { return b ? '☑' : '☐'; }
const SEP = ' | ';
function v(x: any) { return '`' + x + '`'; }
function kv(label: string, val: any) { return '**' + label + '** ' + v(val); }
function pad(x: any, n: number) { return String(x).padEnd(n, ' '); }
function padL(x: any, n: number) { return String(x).padStart(n, ' '); }

// Bloque monoespaciado: Localización + DQ + Calidad Formal en 3 columnas.
function bloqueGrillas(s: any) {
  const loc = s.localizacion, cf = s.calidad_formal, G = s.meta.global_tag;
  const L: string[] = [];
  L.push('```');
  L.push('LOCALIZACIÓN            CALIDAD FORMAL');
  L.push(
    pad(`${G} = ${loc.global}`, 10) + pad(`${G}+D = ${loc.WD}`, 14) +
    '        FQx   MQ   ' + G + '+D'
  );
  L.push(
    pad(`D = ${loc.D}`, 10) + pad(`Dd = ${loc.Dd}`, 14) +
    ' +  = ' + padL(cf.FQx.mas, 3) + padL(cf.MQ.mas, 5) + padL(cf.WD.mas, 5)
  );
  L.push(
    pad(`S = ${loc.S}`, 24) +
    ' o  = ' + padL(cf.FQx.o, 3) + padL(cf.MQ.o, 5) + padL(cf.WD.o, 5)
  );
  L.push(
    pad('', 24) +
    ' u  = ' + padL(cf.FQx.u, 3) + padL(cf.MQ.u, 5) + padL(cf.WD.u, 5)
  );
  L.push(
    pad('DQ', 24) +
    ' -  = ' + padL(cf.FQx.menos, 3) + padL(cf.MQ.menos, 5) + padL(cf.WD.menos, 5)
  );
  L.push(
    pad(`+ = ${loc.DQ_mas}`, 10) + pad(`o = ${loc.DQo}`, 14) +
    'sin = ' + padL(cf.FQx.sin, 3) + padL(cf.MQ.sin, 5) + padL(cf.WD.sin, 5)
  );
  L.push(pad(`v/+ = ${loc.DQ_v_mas}`, 10) + `v = ${loc.DQv}`);
  L.push('```');
  return L;
}

export function formatearSumario(s: any): string {
  return s.meta.layout === 'zdunic' ? formatearZdunic(s) : formatearExner(s);
}

// ---- Layout Zulliger (orden de la hoja de Zdunic) ----
function formatearZdunic(s: any) {
  const meta = s.meta, cab = s.cabecera, ce = s.control_estres, det = s.determinantes;
  const cf = s.calidad_formal, proc = s.procesamiento, ide = s.ideacion;
  const af = s.afectos, inter = s.interpersonal, aut = s.autopercepcion, mk = s.marcadores;
  const G = meta.global_tag;
  const L: string[] = [];

  L.push([kv('Test', meta.test), kv('Normas', meta.normas)].join(SEP));
  if (meta.avisos_codificacion.length > 0) {
    L.push(`> ⚠ **Revisar codificación**`);
    for (const a of meta.avisos_codificacion) L.push(`> - ${a}`);
  }

  for (const line of bloqueGrillas(s)) L.push(line);

  L.push(`### Controles`);
  L.push([kv('R', cab.R), kv('L', t2(cab.Lambda))].join(SEP));
  L.push([kv('EB', ce.EB), kv('EA', t2(ce.EA))].join(SEP));
  L.push([kv('eb', ce.eb), kv('es', ce.es)].join(SEP));
  L.push([kv('EA − es', sg(t2(ce.dif_EA_es))), kv('Estilo', ce.estilo)].join(SEP));
  L.push([kv('FM', det.FM), kv("C'", det.SumC_prima), kv('T', det.SumT)].join(SEP));
  L.push([kv('m', det.m), kv('V', det.SumV), kv('Y', det.SumY)].join(SEP));

  L.push(`### Afectos`);
  L.push([kv('FC:CF+C', `${af.FC}:${af.CF + af.C_puro}`), kv('C pura', af.C_puro), kv('Cn', af.Cn)].join(SEP));
  L.push([kv("SumC':SumPondC", `${af.SumC_prima}:${t2(af.WSumC)}`)].join(SEP));
  L.push([kv('S', af.S)].join(SEP));
  L.push([kv('Complej:R', `${af.Blends}:${cab.R}`)].join(SEP));

  L.push(`### Interpersonal`);
  L.push([kv('COP', inter.COP), kv('AG', inter.AG), kv('AgC', inter.AgC)].join(SEP));
  L.push([kv('GHR:PHR', `${inter.GHR}:${inter.PHR}`), kv('a:p', `${inter.a}:${inter.p}`)].join(SEP));
  L.push([kv('Fd', inter.Fd), kv('SumT', inter.SumT)].join(SEP));
  L.push([kv('SumCont.Humanos', inter.contenidos_humanos), kv('Hpura', inter.H_pura)].join(SEP));
  L.push([kv('PER', inter.PER), kv('Bt+2Cl+Ge+Ls+2Na/R', t2(inter.Aislamiento))].join(SEP));

  L.push(`### Ideación`);
  L.push([kv('a:p', `${ide.a}:${ide.p}`), kv('Ma:Mp', `${ide.Ma}:${ide.Mp}`)].join(SEP));
  L.push([kv('2AB+(Art+Ay)', ide.Intelectualizacion), kv('MOR', ide.MOR)].join(SEP));
  L.push([kv('SumaBruta6', ide.Sum6), kv('Nivel 2', ide.Sum6_lvl2), kv('SumaPond6', ide.WSum6)].join(SEP));
  L.push([kv('M−', ide.M_menos), kv('MQsin', ide.MQ_sin)].join(SEP));

  L.push(`### Mediación`);
  L.push([kv('XA%', t2(cf.XA_pct)), kv('WDA%', t2(cf.WDA_pct))].join(SEP));
  L.push([kv('X−%', t2(cf.X_menos_pct)), kv('S−', cf.S_menos), kv('P', cf.P)].join(SEP));
  L.push([kv('X+%', t2(cf.X_mas_pct)), kv('Xu%', t2(cf.Xu_pct))].join(SEP));

  L.push(`### Procesamiento`);
  L.push([kv(`${G}:D:Dd`, `${proc.global}:${proc.D}:${proc.Dd}`), kv(`${G}:M`, `${proc.global}:${det.M}`)].join(SEP));
  L.push([kv('PSV', proc.PSV)].join(SEP));
  L.push([kv('DQ+', proc.DQ_mas), kv('DQv', proc.DQv), kv('DQv/+', proc.DQ_v_mas)].join(SEP));

  L.push(`### Autopercepción`);
  L.push([kv('3r+(2)/R', t2(aut.Ego)), kv('(2)', aut.Pares), kv('Fr', aut.Fr), kv('FD', aut.FD)].join(SEP));
  L.push([kv('SumV', aut.SumV), kv('An+Xy', aut.An_plus_Xy), kv('MOR', aut.MOR)].join(SEP));
  L.push([kv('H:(H)+Hd+(Hd)', `${aut.H_pura}:${aut.H_paren + aut.Hd + aut.Hd_paren}`)].join(SEP));

  L.push(`### Marcadores`);
  L.push([kv('AgC', `${mk.AgC} rta`), kv('SL', `${mk.SL} rta`)].join(SEP));

  if (meta.no_calculado.length > 0) {
    L.push(`### No aplica en ${meta.test}`);
    for (const n of meta.no_calculado) L.push(`- ${n}`);
  }

  return separar(L);
}

// ---- Layout Rorschach ----
function formatearExner(s: any) {
  const meta = s.meta, cab = s.cabecera, ce = s.control_estres, det = s.determinantes;
  const cf = s.calidad_formal, proc = s.procesamiento, ide = s.ideacion;
  const af = s.afectos, inter = s.interpersonal, aut = s.autopercepcion;
  const k = s.constelaciones, mk = s.marcadores, G = meta.global_tag;
  const L: string[] = [];

  L.push([kv('Test', meta.test), kv('Normas', meta.normas)].join(SEP));
  if (meta.avisos_codificacion.length > 0) {
    L.push(`> ⚠ **Revisar codificación**`);
    for (const a of meta.avisos_codificacion) L.push(`> - ${a}`);
  }

  L.push(`### Controles`);
  L.push([kv('R', cab.R), kv('L', t2(cab.Lambda))].join(SEP));
  L.push([kv('EB', ce.EB), kv('EA', t2(ce.EA)), kv('EBPer', ce.EBPer === null ? 'n/a' : t2(ce.EBPer))].join(SEP));
  L.push([kv('eb', ce.eb), kv('es', ce.es), kv('EA−es', sg(t2(ce.dif_EA_es))), kv('D', sg(ce.D))].join(SEP));
  L.push([kv('Adj es', n0(ce.Adj_es)), kv('EA−Adj es', sg(t2(ce.dif_EA_Adjes))), kv('Adj D', sg(ce.AdjD))].join(SEP));
  L.push([kv('FM', det.FM), kv('m', det.m), kv("C'", det.SumC_prima), kv('T', det.SumT), kv('V', det.SumV), kv('Y', det.SumY)].join(SEP));

  L.push(`### Afectos`);
  L.push([kv('FC:CF+C', `${af.FC}:${af.CF + af.C_puro}`), kv('C pura', af.C_puro), kv('Cn', af.Cn)].join(SEP));
  L.push([kv("SumC':SumPondC", `${af.SumC_prima}:${t2(af.WSumC)}`)].join(SEP));
  L.push([kv('Afr', t2(af.Afr)), kv('S', af.S), kv('CP', n0(af.CP))].join(SEP));
  L.push([kv('Complej:R', `${af.Blends}:${cab.R}`), kv('Mezclas col-somb', af.CS_Blends)].join(SEP));

  L.push(`### Interpersonal`);
  L.push([kv('COP', inter.COP), kv('AG', inter.AG), kv('AgC', inter.AgC), kv('GHR:PHR', `${inter.GHR}:${inter.PHR}`)].join(SEP));
  L.push([kv('a:p', `${inter.a}:${inter.p}`), kv('Fd', inter.Fd), kv('SumT', inter.SumT)].join(SEP));
  L.push([kv('Contenidos Humanos', inter.contenidos_humanos), kv('H Pura', inter.H_pura), kv('PER', inter.PER)].join(SEP));
  L.push([kv('Aislamiento (Bt+2Cl+Ge+Ls+2Na/R)', t2(inter.Aislamiento))].join(SEP));

  L.push(`### Ideación`);
  L.push([kv('a:p', `${ide.a}:${ide.p}`), kv('Ma:Mp', `${ide.Ma}:${ide.Mp}`)].join(SEP));
  L.push([kv('2AB+(Art+Ay)', ide.Intelectualizacion), kv('MOR', ide.MOR)].join(SEP));
  L.push([kv('SumaBruta6', ide.Sum6), kv('Nivel 2', ide.Sum6_lvl2), kv('SumaPond6', ide.WSum6)].join(SEP));
  L.push([kv('M−', ide.M_menos), kv('MQsin', ide.MQ_sin)].join(SEP));

  L.push(`### Mediación`);
  L.push([kv('XA%', t2(cf.XA_pct)), kv('WDA%', t2(cf.WDA_pct))].join(SEP));
  L.push([kv('X+%', t2(cf.X_mas_pct)), kv('Xu%', t2(cf.Xu_pct)), kv('X−%', t2(cf.X_menos_pct))].join(SEP));
  L.push([kv('S−', cf.S_menos), kv('P', cf.P)].join(SEP));

  L.push(`### Procesamiento`);
  L.push([kv('Zf', n0(proc.Zf)), kv('SumZ', t2(proc.ZSum)), kv('Zd', proc.Zd === null ? '—' : sg(t2(proc.Zd)))].join(SEP));
  L.push([kv(`${G}:D:Dd`, `${proc.global}:${proc.D}:${proc.Dd}`), kv(`${G}:M`, `${proc.global}:${det.M}`)].join(SEP));
  L.push([kv('DQ+', proc.DQ_mas), kv('DQv/+', proc.DQ_v_mas), kv('DQv', proc.DQv), kv('PSV', proc.PSV)].join(SEP));

  L.push(`### Autopercepción`);
  L.push([kv('3r+(2)/R', t2(aut.Ego)), kv('(2)', aut.Pares), kv('Fr+rF', aut.Fr_plus_rF)].join(SEP));
  L.push([kv('SumV', aut.SumV), kv('FD', aut.FD), kv('An+Xy', aut.An_plus_Xy), kv('MOR', aut.MOR)].join(SEP));
  L.push([kv('H:(H)+Hd+(Hd)', `${aut.H_pura}:${aut.H_paren + aut.Hd + aut.Hd_paren}`)].join(SEP));

  if (mk.SL > 0) {
    L.push(`### Marcadores`);
    L.push([kv('SL', `${mk.SL} rta`)].join(SEP));
  }

  L.push(`### Constelaciones`);
  const filaC = (n: string, c: any, t: number) => c === null
    ? `**${n}** ${v('n/a')} — no aplica en ${meta.test}`
    : `**${n}** ${v(c.valor + '/' + t)} — ${c.positivo ? '⚠ POSITIVO' : 'negativo'}`;
  L.push(filaC('PTI', k.PTI, 5));
  L.push(filaC('DEPI', k.DEPI, 7));
  L.push(filaC('CDI', k.CDI, 5));
  L.push(filaC('S-CON', k.SCON, 12));
  if (k.HVI) L.push(`**HVI** ${v(k.HVI.sub_cumplidos + '/7 sub')} — ${k.HVI.positivo ? '⚠ POSITIVO' : 'negativo'}`);
  if (k.OBS) L.push(`**OBS** ${v(k.OBS.path)} — ${k.OBS.positivo ? '⚠ POSITIVO' : 'negativo'}`);

  const detalle = (nombre: string, obj: any, tot: number) => {
    if (!obj) return;
    L.push(`### Detalle ${nombre} (${obj.valor}/${tot})`);
    for (const [crit, val] of Object.entries(obj.criterios)) L.push(`- ${chk(val as boolean)} ${crit}`);
  };
  if (k.DEPI && k.DEPI.positivo) detalle('DEPI', k.DEPI, 7);
  if (k.SCON && k.SCON.positivo) detalle('S-CON', k.SCON, 12);
  if (k.CDI && k.CDI.positivo) detalle('CDI', k.CDI, 5);
  if (k.PTI && k.PTI.positivo) detalle('PTI', k.PTI, 5);

  if (meta.no_calculado.length > 0) {
    L.push(`### No calculado`);
    for (const n of meta.no_calculado) L.push(`- ${n}`);
  }

  return separar(L);
}

// Línea en blanco antes de cada subtítulo (###)
function separar(L: string[]) {
  const out: string[] = [];
  for (let i = 0; i < L.length; i++) {
    if (L[i].startsWith('### ') && out.length > 0) out.push('');
    out.push(L[i]);
  }
  return out.join('\n');
}

/**
 * Qué perfil corresponde, mirando las láminas cargadas.
 *
 * El wrapper de Airtable lo tomaba del campo "Test aplicado" del individuo.
 * Acá se deduce del protocolo: las láminas Z1..Z3 son de Zulliger y las
 * romanas de Rorschach. Si hay de las dos, se devuelve el motivo en vez de
 * elegir una, porque mezclar protocolos da un sumario que no es de ninguno.
 */
export function perfilDe(laminas: string[]): { perfil: Perfil } | { motivo: string } {
  const zul = laminas.filter((l) => PERFILES.Zulliger.laminas.includes(l)).length;
  const ror = laminas.filter((l) => PERFILES.Rorschach.laminas.includes(l)).length;

  if (zul > 0 && ror > 0) {
    return {
      motivo:
        'Hay respuestas de los dos tests en el mismo protocolo (láminas romanas y Z1-Z3). ' +
        'Separalas antes de calcular: un sumario mezclado no es de ninguno de los dos.',
    };
  }
  if (zul > 0) return { perfil: PERFILES.Zulliger };
  if (ror > 0) return { perfil: PERFILES.Rorschach };
  return { motivo: 'Ninguna respuesta tiene lámina cargada, así que no se sabe qué test es.' };
}
