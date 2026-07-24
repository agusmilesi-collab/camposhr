/**
 * Acceso a Airtable — SOLO LECTURA y SOLO CAMPOS PERMITIDOS.
 *
 * Regla de seguridad: nunca pedimos los campos clínicos (sumario Rorschach,
 * Benziger, Raven, CV, mails, teléfonos, facturación). Se piden explícitamente
 * los IDs de campo habilitados, así Airtable no los devuelve nunca.
 * Si mañana alguien agrega un campo sensible, no aparece acá salvo que se
 * lo agregue a mano a estas listas.
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

async function get(path: string, params: URLSearchParams) {
  const res = await fetch(`${API}/${BASE}/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token()}` },
    next: { revalidate: 60 }, // cachea 1 minuto
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

  // 1) Resolver el token a su empresa (y sus pedidos) desde Airtable.
  const emp = (await getEmpresasConToken()).find(
    (e) => e.token === portalToken
  );
  if (!emp) return null;

  const empresa = emp.nombre;
  const pedidoIds = emp.pedidoIds;

  if (pedidoIds.length === 0) return { empresa, busquedas: [] };

  // 2) Los pedidos
  const pp = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    filterByFormula: orRecordIds(pedidoIds),
    pageSize: '100',
  });
  Object.values(F_PEDIDO).forEach((f) => pp.append('fields[]', f));
  const pedidosRes = await get(T_PEDIDOS, pp);

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
    const candRes = await get(T_INDIVIDUO, pc);

    for (const r of candRes.records ?? []) {
      const f = r.fields ?? {};
      const eIds: string[] = (f[F_INDIVIDUO.evaluadoras] ?? []).map((e: any) =>
        typeof e === 'string' ? e : e.id
      );
      candEvalIds.set(r.id, eIds);
      eIds.forEach((id) => evalIds.add(id));
      candMap.set(r.id, {
        id: r.id,
        nombre: f[F_INDIVIDUO.nombre] ?? 'Sin nombre',
        estado: f[F_INDIVIDUO.estado] ?? 'Sin asignar',
        evaluadora: null,
        fechaEntrevista: f[F_INDIVIDUO.fechaEntrevista] ?? null,
        fechaEntrega: f[F_INDIVIDUO.fechaEntrega] ?? null,
        modalidad: f[F_INDIVIDUO.modalidad] ?? null,
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

  return { empresa, busquedas };
}
