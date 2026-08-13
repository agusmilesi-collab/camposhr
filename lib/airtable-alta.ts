/**
 * Alta de pedidos en Airtable. **Es el único archivo que escribe.**
 *
 * Va aparte de `lib/airtable.ts` para que ese siga siendo solo lectura de punta
 * a punta, que es la garantía del portal.
 *
 * Usa `AIRTABLE_TOKEN_ESCRITURA`, un token distinto del de lectura y con el
 * permiso mínimo: `data.records:write` sobre la base Psicotécnicos. Sin esa
 * variable cargada, `puedeEscribir()` da false y el formulario valida y muestra
 * el resumen sin guardar nada, que es como funciona hoy.
 */
const BASE = 'appGhbo58t44fOIGe';
const API = 'https://api.airtable.com/v0';
const SUBIDA = 'https://content.airtable.com/v0';

const T_PEDIDOS = 'tblA3o1XsDXyJXSgF';
const T_INDIVIDUO = 'tbl6Ji4P7d6hOKNUY';

const F_PEDIDO = {
  puesto: 'fldtTUFvYpONO0bVy',
  cliente: 'fldjIThg01jtXWch3',
  bateria: 'fldnaf4eGW4IWojjx',
  fecha: 'flduuRp2F5ZHnWc8c',
  notas: 'fld0LMQloe3IM3By4',
  contexto: 'fld7vRjwXtMjiNxNu',
};

const F_INDIVIDUO = {
  nombre: 'fldB61ycDOKvlCTaQ',
  pedido: 'fldbaPMlvmaIcAwHX',
  estado: 'fld8LoQEBcWSqzJhY',
  mail: 'fldR8YFPuYJT0C4bA',
  telefono: 'fldUYat8d8k5KVESU',
  cv: 'fldsIJFJdXicBxCfa',
};

/** Las tres baterías, por código, como registros de la tabla Baterías. */
const REG_BATERIA: Record<string, string> = {
  'Batería 1': 'recFjzEWPDmOiz0uG',
  'Batería 2': 'recTJ3KzWphTl4DoO',
  'Batería 3': 'recNhkP4w4Omm396L',
};

/** El endpoint de adjuntos de Airtable recibe el archivo en base64 y no acepta
 *  más de 5 MB por esa vía, aunque el campo tolere archivos más grandes. */
const MAX_ADJUNTO = 5 * 1024 * 1024;

export function puedeEscribir(): boolean {
  return Boolean(process.env.AIRTABLE_TOKEN_ESCRITURA);
}

function token(): string {
  const t = process.env.AIRTABLE_TOKEN_ESCRITURA;
  if (!t) throw new Error('Falta AIRTABLE_TOKEN_ESCRITURA.');
  return t;
}

async function post(url: string, cuerpo: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export type PedidoNuevo = {
  empresaId: string;
  puesto: string;
  candidato: string;
  telefono: string | null;
  mail: string | null;
  bateria: string;
  descripcion: string | null;
  comentarios: string | null;
  cv: File | null;
};

/**
 * Crea el pedido y su candidato, y engancha el CV si vino.
 *
 * El orden importa: primero el pedido, porque el candidato cuelga de él. Si el
 * CV falla, el pedido igual queda cargado y se avisa aparte: perder el alta
 * entera por un adjunto sería peor que cargarlo a mano después.
 */
export async function crearPedido(p: PedidoNuevo): Promise<{
  pedidoId: string;
  candidatoId: string;
  cvCargado: boolean;
}> {
  const bateriaId = REG_BATERIA[p.bateria];

  const pedidoRes = await post(`${API}/${BASE}/${T_PEDIDOS}`, {
    records: [
      {
        fields: {
          [F_PEDIDO.puesto]: p.puesto,
          [F_PEDIDO.cliente]: [p.empresaId],
          ...(bateriaId ? { [F_PEDIDO.bateria]: [bateriaId] } : {}),
          // La fecha la pone el servidor, no el formulario.
          [F_PEDIDO.fecha]: new Date().toISOString().slice(0, 10),
          ...(p.descripcion ? { [F_PEDIDO.contexto]: p.descripcion } : {}),
          ...(p.comentarios ? { [F_PEDIDO.notas]: p.comentarios } : {}),
        },
      },
    ],
  });
  const pedidoId: string = pedidoRes.records[0].id;

  const candRes = await post(`${API}/${BASE}/${T_INDIVIDUO}`, {
    records: [
      {
        fields: {
          [F_INDIVIDUO.nombre]: p.candidato,
          [F_INDIVIDUO.pedido]: [pedidoId],
          [F_INDIVIDUO.estado]: 'Por citar',
          ...(p.mail ? { [F_INDIVIDUO.mail]: p.mail } : {}),
          ...(p.telefono ? { [F_INDIVIDUO.telefono]: p.telefono } : {}),
        },
      },
    ],
  });
  const candidatoId: string = candRes.records[0].id;

  let cvCargado = false;
  if (p.cv && p.cv.size > 0 && p.cv.size <= MAX_ADJUNTO) {
    try {
      const base64 = Buffer.from(await p.cv.arrayBuffer()).toString('base64');
      await post(
        `${SUBIDA}/${BASE}/${candidatoId}/${F_INDIVIDUO.cv}/uploadAttachment`,
        {
          contentType: p.cv.type || 'application/octet-stream',
          file: base64,
          filename: p.cv.name,
        }
      );
      cvCargado = true;
    } catch {
      cvCargado = false;
    }
  }

  return { pedidoId, candidatoId, cvCargado };
}
