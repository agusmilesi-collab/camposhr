/**
 * Acceso a Airtable — SOLO LECTURA y SOLO CAMPOS PERMITIDOS.
 *
 * Regla de seguridad: nunca pedimos los campos clínicos (sumario Rorschach,
 * Benziger, Raven), ni el CV, ni el mail o el teléfono del candidato. Se piden
 * explícitamente los IDs de campo habilitados, así Airtable no los devuelve
 * nunca. Si mañana alguien agrega un campo sensible, no aparece acá salvo que
 * se lo agregue a mano a estas listas.
 *
 * De facturación viajan dos tildes y nada más: si la evaluación se facturó y
 * si esa factura se pagó. El importe, la condición fiscal y la factura en sí
 * quedan afuera.
 */

const BASE = 'appGhbo58t44fOIGe';
const API = 'https://api.airtable.com/v0';

const T_EMPRESAS = 'tblNKMu8gqYmoA70N';
const T_PEDIDOS = 'tblA3o1XsDXyJXSgF';
const T_INDIVIDUO = 'tbl6Ji4P7d6hOKNUY';
const T_EVALUADORAS = 'tblBhmxk02yBccL8d';

// ---- Campos habilitados (lista blanca) ----
const F_EMPRESA = {
  nombre: 'fldxtqa4czxTXkLav',
  pedidos: 'fldsBK2W9rVdL4GEV',
};

// Campo del token del portal en la tabla Empresas. Llenarlo da de alta el
// portal del cliente (clientes.camposhr.com/<token>). No es un dato que se
// devuelva al cliente: sólo se usa para resolver token -> empresa y para el
// listado interno de accesos.
const F_EMPRESA_TOKEN = 'fldyVg8er3tVOx10Z';

/** La empresa inventada con la que se prueba. Ver lib/portal-demo.ts. */
const EMPRESA_PRUEBA = 'recX2DYWlVzjLoAXT';

// Formato válido de token (base64url). Se valida antes de usarlo.
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{8,128}$/;

const F_PEDIDO = {
  puesto: 'fldtTUFvYpONO0bVy',
  estado: 'fldVtnnDGanAlNHz8',
  fecha: 'flduuRp2F5ZHnWc8c',
  area: 'fldaqG1SZjVya8CNw',
  seniority: 'fldMSMgrUyKTYTEaa',
  candidatos: 'fldFTOInPjwCqrbwk',
};

const F_INDIVIDUO = {
  nombre: 'fldB61ycDOKvlCTaQ',
  estado: 'fld8LoQEBcWSqzJhY',
  fechaEntrevista: 'fldWRpCder4umuBs6',
  fechaEntrega: 'fldaS7nfUewSX3EkQ',
  modalidad: 'fldsKnmbEoilCde7P',
  pedido: 'fldbaPMlvmaIcAwHX',
  evaluadoras: 'fldsBC99zh44BSgBN',
  recomendacion: 'fldIWX9RcrBUCpTE6',
  // "Informe PDF": el documento que el cliente ya recibió por el canal
  // acordado. Es la única excepción a la regla de arriba, y va acotada: al
  // portal solo llega si el candidato está en estado Entregado, y nunca la URL
  // del adjunto, que se resuelve al momento del clic (ver getUrlInforme).
  informe: 'fldE7x9euo0ElSLqI',
  // Estado de cobro. Son dos tildes, sin importe ni número de factura.
  facturado: 'fldVKvyVdlE3LuRiA',
  pagado: 'fldoR1HvONqBpxKvN',
};

// Tabla Evaluadoras: sólo el nombre (campo primario). Se usa para resolver
// los enlaces del campo Evaluadoras de cada individuo a texto legible.
const F_EVALUADORA = {
  nombre: 'fldqhNqXayYQcyKJA',
};

function token(): string {
  const t = process.env.AIRTABLE_TOKEN;
  if (!t) throw new Error('Falta AIRTABLE_TOKEN en las variables de entorno.');
  return t;
}

async function get(path: string, params: URLSearchParams, sinCache = false) {
  const res = await fetch(`${API}/${BASE}/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token()}` },
    // Un minuto de caché alcanza para el portal, donde los datos los mueve el
    // equipo desde Airtable. La empresa de prueba lee sin caché: ahí el pedido
    // lo acaba de cargar quien está mirando la pantalla, y esperar el minuto se
    // lee como que no se guardó.
    ...(sinCache ? { cache: 'no-store' as const } : { next: { revalidate: 60 } }),
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}`);
  }
  return res.json();
}

function orRecordIds(ids: string[]): string {
  if (ids.length === 0) return 'FALSE()';
  return `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
}

export type Candidato = {
  id: string;
  nombre: string;
  estado: string;
  evaluadora: string | null;
  fechaEntrevista: string | null;
  fechaEntrega: string | null;
  modalidad: string | null;
  /** Conclusión del informe: Apto, Apto con observaciones, Apto con alertas,
   *  No apto. Solo se muestra en los candidatos ya entregados. */
  recomendacion: string | null;
  /** Hay un PDF de informe cargado y el candidato está entregado. */
  tieneInforme: boolean;
  /** Estado de cobro de esa evaluación. Son dos preguntas encadenadas: si no
   *  está facturada, lo pagado no aplica. `null` = todavía sin cargar. */
  facturado: boolean | null;
  pagado: boolean | null;
};

export type Busqueda = {
  id: string;
  puesto: string;
  estado: string;
  area: string | null;
  seniority: string | null;
  fecha: string | null;
  candidatos: Candidato[];
};

export type DatosCliente = {
  empresa: string;
  /** ID del registro en Airtable. Lo usa lib/servicios.ts para saber qué
   *  documentos tiene este cliente además de las evaluaciones. */
  empresaId: string | null;
  busquedas: Busqueda[];
};

type EmpresaPortal = {
  id: string;
  nombre: string;
  token: string;
  pedidoIds: string[];
};

/**
 * Empresas que tienen portal (campo Token portal cargado). Se piden sólo los
 * campos de la lista blanca por ID (no por nombre), así el token vive en
 * Airtable y dar de alta un cliente es llenar el campo. Tope de 100 empresas.
 */
async function getEmpresasConToken(): Promise<EmpresaPortal[]> {
  const params = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    pageSize: '100',
  });
  params.append('fields[]', F_EMPRESA.nombre);
  params.append('fields[]', F_EMPRESA.pedidos);
  params.append('fields[]', F_EMPRESA_TOKEN);

  let res;
  try {
    res = await get(T_EMPRESAS, params);
  } catch {
    return [];
  }

  const out: EmpresaPortal[] = [];
  for (const r of res.records ?? []) {
    // La empresa de prueba queda afuera del listado de accesos siempre. El
    // campo del token se le vació a mano, pero hay una automatización que lo
    // llena al crear la empresa: si vuelve a correr, este filtro la sigue
    // dejando fuera de tools.camposhr.com/informes.
    if (r.id === EMPRESA_PRUEBA) continue;
    const f = r.fields ?? {};
    const tok = f[F_EMPRESA_TOKEN];
    if (typeof tok !== 'string' || !TOKEN_VALIDO.test(tok)) continue;
    out.push({
      id: r.id,
      nombre: f[F_EMPRESA.nombre] ?? 'Cliente',
      token: tok,
      pedidoIds: (f[F_EMPRESA.pedidos] ?? []).map((p: any) =>
        typeof p === 'string' ? p : p.id
      ),
    });
  }
  return out;
}

/**
 * Clientes con acceso al portal: token + empresa. Para el listado interno.
 */
export async function listarClientesConToken(): Promise<
  { token: string; empresaId: string; nombre: string }[]
> {
  const empresas = await getEmpresasConToken();
  return empresas.map((e) => ({
    token: e.token,
    empresaId: e.id,
    nombre: e.nombre,
  }));
}

export async function getDatosCliente(
  portalToken: string
): Promise<DatosCliente | null> {
  if (!TOKEN_VALIDO.test(portalToken)) return null;

  // Resolver el token a su empresa (y sus pedidos) desde Airtable.
  const emp = (await getEmpresasConToken()).find(
    (e) => e.token === portalToken
  );
  if (!emp) return null;
  return armarDatos(emp.nombre, emp.id, emp.pedidoIds);
}

/**
 * Los mismos datos, pero entrando por el ID de la empresa en vez del token.
 *
 * Lo usa la empresa de prueba, que a propósito no tiene token cargado: así no
 * figura en el listado de accesos ni tiene portal público, y sirve igual para
 * probar el circuito contra datos de verdad.
 */
export async function getDatosClientePorEmpresa(
  empresaId: string
): Promise<DatosCliente | null> {
  // Va por el endpoint de listado con un filtro por ID, y no por el de registro
  // suelto: ese no acepta `fields[]`, y sin lista blanca traería la tabla
  // entera, incluido el token del portal.
  const params = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    filterByFormula: orRecordIds([empresaId]),
    pageSize: '1',
  });
  params.append('fields[]', F_EMPRESA.nombre);
  params.append('fields[]', F_EMPRESA.pedidos);

  let res;
  try {
    res = await get(T_EMPRESAS, params, true);
  } catch {
    return null;
  }
  const f = res.records?.[0]?.fields ?? null;
  if (!f) return null;
  const pedidoIds: string[] = (f[F_EMPRESA.pedidos] ?? []).map((p: any) =>
    typeof p === 'string' ? p : p.id
  );
  return armarDatos(f[F_EMPRESA.nombre] ?? 'Cliente', empresaId, pedidoIds, true);
}

async function armarDatos(
  empresa: string,
  empresaId: string | null,
  pedidoIds: string[],
  sinCache = false
): Promise<DatosCliente> {

  if (pedidoIds.length === 0) return { empresa, empresaId, busquedas: [] };

  // 2) Los pedidos
  const pp = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    filterByFormula: orRecordIds(pedidoIds),
    pageSize: '100',
  });
  Object.values(F_PEDIDO).forEach((f) => pp.append('fields[]', f));
  const pedidosRes = await get(T_PEDIDOS, pp, sinCache);

  // 3) Los candidatos de esos pedidos
  const candIds = new Set<string>();
  for (const r of pedidosRes.records ?? []) {
    for (const c of r.fields?.[F_PEDIDO.candidatos] ?? []) {
      candIds.add(typeof c === 'string' ? c : c.id);
    }
  }

  const candMap = new Map<string, Candidato>();
  // candId -> ids de registro de sus evaluadoras (a resolver a nombre después)
  const candEvalIds = new Map<string, string[]>();
  const evalIds = new Set<string>();
  if (candIds.size > 0) {
    const pc = new URLSearchParams({
      returnFieldsByFieldId: 'true',
      filterByFormula: orRecordIds(Array.from(candIds)),
      pageSize: '100',
    });
    Object.values(F_INDIVIDUO).forEach((f) => pc.append('fields[]', f));
    const candRes = await get(T_INDIVIDUO, pc, sinCache);

    for (const r of candRes.records ?? []) {
      const f = r.fields ?? {};
      const eIds: string[] = (f[F_INDIVIDUO.evaluadoras] ?? []).map((e: any) =>
        typeof e === 'string' ? e : e.id
      );
      candEvalIds.set(r.id, eIds);
      eIds.forEach((id) => evalIds.add(id));
      const estado = f[F_INDIVIDUO.estado] ?? 'Sin asignar';
      candMap.set(r.id, {
        id: r.id,
        nombre: f[F_INDIVIDUO.nombre] ?? 'Sin nombre',
        estado,
        evaluadora: null,
        fechaEntrevista: f[F_INDIVIDUO.fechaEntrevista] ?? null,
        fechaEntrega: f[F_INDIVIDUO.fechaEntrega] ?? null,
        modalidad: f[F_INDIVIDUO.modalidad] ?? null,
        // La recomendación es la conclusión del informe: no se muestra antes de
        // entregarlo, así que ni siquiera se carga en los demás estados.
        recomendacion:
          estado === 'Entregado' ? f[F_INDIVIDUO.recomendacion] ?? null : null,
        tieneInforme:
          estado === 'Entregado' &&
          (f[F_INDIVIDUO.informe] ?? []).length > 0,
        // Las dos tildes de cobro. Airtable omite el campo cuando está sin
        // tildar, así que ausencia y "no" son lo mismo: false.
        facturado: f[F_INDIVIDUO.facturado] === true,
        pagado: f[F_INDIVIDUO.pagado] === true,
      });
    }
  }

  // Resolver los nombres de las evaluadoras y asignarlos a cada candidato
  if (evalIds.size > 0) {
    const ev = new URLSearchParams({
      returnFieldsByFieldId: 'true',
      filterByFormula: orRecordIds(Array.from(evalIds)),
      pageSize: '100',
    });
    Object.values(F_EVALUADORA).forEach((f) => ev.append('fields[]', f));
    const evalRes = await get(T_EVALUADORAS, ev);

    const evalNames = new Map<string, string>();
    for (const r of evalRes.records ?? []) {
      const nombre = r.fields?.[F_EVALUADORA.nombre];
      if (nombre) evalNames.set(r.id, nombre);
    }

    for (const [candId, ids] of candEvalIds) {
      const nombres = ids.map((id) => evalNames.get(id)).filter(Boolean);
      const cand = candMap.get(candId);
      if (cand && nombres.length > 0) cand.evaluadora = nombres.join(', ');
    }
  }

  // 4) Armar la estructura, ocultando pedidos cancelados
  const busquedas: Busqueda[] = (pedidosRes.records ?? [])
    .filter((r: any) => r.fields?.[F_PEDIDO.estado] !== 'Cancelado')
    .map((r: any) => {
      const f = r.fields ?? {};
      const ids: string[] = (f[F_PEDIDO.candidatos] ?? []).map((c: any) =>
        typeof c === 'string' ? c : c.id
      );
      return {
        id: r.id,
        puesto: f[F_PEDIDO.puesto] ?? 'Sin puesto',
        estado: f[F_PEDIDO.estado] ?? '',
        area: f[F_PEDIDO.area] ?? null,
        seniority: f[F_PEDIDO.seniority] ?? null,
        fecha: f[F_PEDIDO.fecha] ?? null,
        candidatos: ids
          .map((id) => candMap.get(id))
          .filter(Boolean)
          .sort((a, b) => a!.nombre.localeCompare(b!.nombre)) as Candidato[],
      };
    })
    .sort((a: Busqueda, b: Busqueda) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

  return { empresa, empresaId, busquedas };
}
