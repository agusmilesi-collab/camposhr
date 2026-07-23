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

// ---- Campos habilitados (lista blanca) ----
const F_EMPRESA = {
  nombre: 'fldxtqa4czxTXkLav',
  pedidos: 'fldsBK2W9rVdL4GEV',
};

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

export async function getDatosCliente(empresaId: string): Promise<DatosCliente | null> {
  // 1) La empresa y sus pedidos
  const pe = new URLSearchParams({ returnFieldsByFieldId: 'true' });
  Object.values(F_EMPRESA).forEach((f) => pe.append('fields[]', f));

  let empresaRec;
  try {
    empresaRec = await get(`${T_EMPRESAS}/${empresaId}`, pe);
  } catch {
    return null;
  }

  const ef = empresaRec.fields ?? {};
  const empresa: string = ef[F_EMPRESA.nombre] ?? 'Cliente';
  const pedidoIds: string[] = (ef[F_EMPRESA.pedidos] ?? []).map((r: any) =>
    typeof r === 'string' ? r : r.id
  );

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
      candMap.set(r.id, {
        id: r.id,
        nombre: f[F_INDIVIDUO.nombre] ?? 'Sin nombre',
        estado: f[F_INDIVIDUO.estado] ?? 'Sin asignar',
        fechaEntrevista: f[F_INDIVIDUO.fechaEntrevista] ?? null,
        fechaEntrega: f[F_INDIVIDUO.fechaEntrega] ?? null,
        modalidad: f[F_INDIVIDUO.modalidad] ?? null,
      });
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
