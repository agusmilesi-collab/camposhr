#!/usr/bin/env node
/**
 * Trae de Airtable todo lo que todavía no está en Supabase.
 *
 *     node scripts/migrar-airtable.mjs              # ensayo: no escribe nada
 *     node scripts/migrar-airtable.mjs --de-verdad  # escribe
 *
 * **Correrlo dos veces no duplica.** Cada fila viaja con su `airtable_id` y el
 * script busca por ese id antes de insertar: lo que ya está, se completa. Eso lo
 * vuelve retomable, que es lo que hace falta cuando algo falla en el medio de
 * setenta expedientes.
 *
 * **Los sumarios no se copian: se recalculan.** El motor del OS los arma desde
 * las respuestas recién migradas y el script compara el resultado contra el
 * `Sumario JSON` de Airtable. Un sumario que no coincide es una respuesta mal
 * traída, y es el único control que lo detecta: los números de la codificación
 * entran uno por uno y un error ahí no se ve hasta el informe.
 *
 * Lo que no trae, decidido el 25/8/2026 (ver `CAMPOS OS/SPECS-migracion.md`):
 * Distribuidora Andina, que es la empresa de prueba, y los PDF de informes
 * viejos, porque el informe se arma desde los datos y se van a contrastar con
 * los que escribieron las psicólogas.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// ─── Configuración ────────────────────────────────────────────────────────────

const RAIZ = new URL('..', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(`${RAIZ}.env.local`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const BASE = 'appGhbo58t44fOIGe';
const TABLAS = {
  empresas: 'tblNKMu8gqYmoA70N',
  pedidos: 'tblA3o1XsDXyJXSgF',
  individuo: 'tbl6Ji4P7d6hOKNUY',
  respuestas: 'tblhq78e1RSmvztC5',
  benziger: 'tbl5Oi3FXtS5SPFoH',
  facturas: 'tblAlfhQ1QePwOhuH',
  evaluadoras: 'tblBhmxk02yBccL8d',
};

/** La empresa de prueba no se migra: sus candidatos son inventados. */
const NO_MIGRAR = ['Distribuidora Andina (prueba)'];

/**
 * Los candidatos de Laruso que no cuelgan de ningún pedido.
 *
 * Son diecisiete y todos de Laruso: el trabajo ahí no fue una selección sino un
 * mapeo de la gente que ya está adentro, y por eso nadie abrió un pedido por
 * persona. Se les arma uno solo, porque sin pedido una persona queda sin saber
 * a qué entró, que es lo único que explica qué se le tomó y por qué.
 */
const PEDIDO_HUERFANOS = {
  empresa: 'Laruso',
  puesto: 'Mapeo organizacional',
  familia: 'RRHH / Capital Humano',
};

const deVerdad = process.argv.includes('--de-verdad');
const OS = env.OS_URL ?? 'http://localhost:3000';

// ─── Los dos lados ────────────────────────────────────────────────────────────

async function airtable(tabla) {
  const filas = [];
  let offset;
  do {
    const q = `https://api.airtable.com/v0/${BASE}/${tabla}?pageSize=100${
      offset ? `&offset=${offset}` : ''
    }`;
    const r = await fetch(q, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!r.ok) throw new Error(`Airtable ${tabla}: ${r.status} ${await r.text()}`);
    const d = await r.json();
    filas.push(...d.records);
    offset = d.offset;
  } while (offset);
  return filas;
}

async function supa(camino, opciones = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${camino}`, {
    ...opciones,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opciones.method === 'POST' ? 'return=representation' : 'return=minimal',
      ...(opciones.headers ?? {}),
    },
    cache: 'no-store',
  });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`Supabase ${camino}: ${r.status} ${cuerpo}`);
  // Con `return=minimal` la respuesta viene vacía aunque el código sea 201:
  // parsearla a ciegas cortaba la migración a mitad de camino.
  return cuerpo ? JSON.parse(cuerpo) : null;
}

/** Inserta y devuelve la fila, o devuelve la que ya estaba por su `airtable_id`. */
async function poner(tabla, airtableId, fila) {
  if (airtableId) {
    const previas = await supa(`${tabla}?select=id&airtable_id=eq.${airtableId}&limit=1`);
    if (previas[0]) return { id: previas[0].id, nuevo: false };
  }
  if (!deVerdad) return { id: `(ensayo)`, nuevo: true };
  const creada = await supa(tabla, {
    method: 'POST',
    body: JSON.stringify({ ...fila, airtable_id: airtableId ?? null }),
  });
  return { id: creada[0].id, nuevo: true };
}

// ─── Traducciones ─────────────────────────────────────────────────────────────

const primero = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const fecha = (v) => (typeof v === 'string' ? v.slice(0, 10) : null);
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** El slug con el que se reconoce una empresa que ya está cargada. */
const slug = (n) =>
  n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ─── La migración ─────────────────────────────────────────────────────────────

const cuenta = { nuevos: {}, saltados: {}, avisos: [] };
const sumo = (donde, k, n = 1) => (cuenta[donde][k] = (cuenta[donde][k] ?? 0) + n);

async function main() {
  console.log(deVerdad ? '── Migrando de verdad ──\n' : '── Ensayo: no se escribe nada ──\n');

  const [aEmpresas, aPedidos, aIndividuo, aRespuestas, aBenziger, aFacturas, aEvaluadoras] =
    await Promise.all(Object.values(TABLAS).map(airtable));

  // Las dos evaluadoras y las tres baterías ya están: se resuelven por nombre.
  const evaluadoras = Object.fromEntries(
    (await supa('evaluadoras?select=id,nombre')).map((e) => [e.nombre, e.id])
  );
  const baterias = Object.fromEntries(
    (await supa('baterias?select=id,codigo')).map((b) => [b.codigo, b.id])
  );
  const nombreEvaluadora = Object.fromEntries(
    aEvaluadoras.map((e) => [e.id, e.fields['Nombre'] ?? e.fields['Name']])
  );
  const nombreBateria = Object.fromEntries(
    (await airtable('tbl32bHLZ3sKv4Lt2')).map((b) => [b.id, b.fields['Código'] ?? b.fields['Name']])
  );

  // ── 1. Empresas ────────────────────────────────────────────────────────────
  const empresaDe = {};
  for (const e of aEmpresas) {
    const nombre = e.fields['Name'];
    if (NO_MIGRAR.includes(nombre)) {
      sumo('saltados', 'empresas de prueba');
      continue;
    }
    const previas = await supa(`empresas?select=id&slug=eq.${slug(nombre)}&limit=1`);
    if (previas[0]) {
      empresaDe[e.id] = previas[0].id;
      sumo('saltados', 'empresas que ya estaban');
      continue;
    }
    const fila = {
      nombre,
      slug: slug(nombre),
      activa: true,
      razon_social: e.fields['Razón social'] ?? null,
      cuit: e.fields['CUIT'] ? String(e.fields['CUIT']) : null,
      condicion_iva: e.fields['Condición IVA'] ?? null,
      contacto: e.fields['Contacto'] ?? null,
      email_facturacion: e.fields['Email facturación'] ?? null,
      direccion_fiscal: e.fields['Dirección fiscal'] ?? null,
      rubro: e.fields['Rubro'] ?? null,
    };
    empresaDe[e.id] = deVerdad ? (await supa('empresas', { method: 'POST', body: JSON.stringify(fila) }))[0].id : '(ensayo)';
    sumo('nuevos', 'empresas');
  }

  // ── 2. Pedidos ─────────────────────────────────────────────────────────────
  const pedidoDe = {};
  for (const p of aPedidos) {
    const empresa = empresaDe[primero(p.fields['Cliente'])];
    if (!empresa) {
      sumo('saltados', 'pedidos de la empresa de prueba');
      continue;
    }
    const fila = {
      empresa_id: empresa,
      puesto: p.fields['Posición buscada'] ?? p.fields['Puesto'] ?? 'Sin puesto',
      estado: p.fields['Estado'] ?? 'En curso',
      familia: p.fields['Familia de puesto'] ?? null,
      seniority: p.fields['Seniority'] ?? null,
      bateria_id: baterias[nombreBateria[primero(p.fields['Batería'])]] ?? null,
      fecha_pedido: fecha(p.fields['Fecha de pedido']),
      origen: 'interno',
    };
    const { id, nuevo } = await poner('pedidos', p.id, fila);
    pedidoDe[p.id] = id;
    sumo(nuevo ? 'nuevos' : 'saltados', 'pedidos');
  }

  // El pedido de los huérfanos, uno solo para todos.
  let pedidoMapeo = null;
  const huerfanos = aIndividuo.filter((i) => !primero(i.fields['Pedido']));
  if (huerfanos.length > 0) {
    const idEmpresa = Object.entries(empresaDe).find(
      ([recId]) => aEmpresas.find((e) => e.id === recId)?.fields['Name'] === PEDIDO_HUERFANOS.empresa
    )?.[1];
    if (!idEmpresa) {
      cuenta.avisos.push(`No encontré la empresa ${PEDIDO_HUERFANOS.empresa} para los huérfanos.`);
    } else if (idEmpresa === '(ensayo)') {
      // En ensayo la empresa todavía no existe, así que no hay contra qué
      // buscar el pedido. Se cuenta, y los huérfanos lo toman como destino para
      // que el parte no los liste a los diecisiete como si se fueran a perder.
      pedidoMapeo = '(ensayo)';
      sumo('nuevos', `pedido "${PEDIDO_HUERFANOS.puesto}" para los ${huerfanos.length} sin pedido`);
    } else {
      const previas = await supa(
        `pedidos?select=id&empresa_id=eq.${idEmpresa}&puesto=eq.${encodeURIComponent(PEDIDO_HUERFANOS.puesto)}&limit=1`
      );
      pedidoMapeo = previas[0]?.id ?? null;
      if (!pedidoMapeo && deVerdad) {
        pedidoMapeo = (
          await supa('pedidos', {
            method: 'POST',
            body: JSON.stringify({
              empresa_id: idEmpresa,
              puesto: PEDIDO_HUERFANOS.puesto,
              estado: 'En curso',
              familia: PEDIDO_HUERFANOS.familia,
              origen: 'interno',
            }),
          })
        )[0].id;
      }
      if (!previas[0]) sumo('nuevos', `pedido "${PEDIDO_HUERFANOS.puesto}" para los ${huerfanos.length} sin pedido`);
    }
  }

  // ── 3. Personas y evaluaciones ─────────────────────────────────────────────
  const evaluacionDe = {};
  for (const i of aIndividuo) {
    const f = i.fields;
    const recPedido = primero(f['Pedido']);
    const pedido = recPedido ? pedidoDe[recPedido] : pedidoMapeo;
    if (recPedido && !pedido) {
      sumo('saltados', 'expedientes de la empresa de prueba');
      continue;
    }
    if (!pedido) {
      cuenta.avisos.push(`${f['Nombre']}: sin pedido y sin dónde colgarlo.`);
      continue;
    }

    // La empresa sale del pedido, que es de quien pidió la búsqueda.
    const recEmpresa = primero(f['Empresa (mapeo)']) ?? primero(f['Empresa']);
    const empresa = empresaDe[recEmpresa] ?? null;

    const persona = await poner('personas', i.id, {
      empresa_id: empresa,
      nombre: f['Nombre'] ?? 'Sin nombre',
      email: f['Email'] ?? null,
      telefono: f['Teléfono'] ? String(f['Teléfono']) : null,
      origen: 'interno',
    });

    const evaluadora = evaluadoras[nombreEvaluadora[primero(f['Evaluadoras'])]] ?? null;
    const evaluacion = await poner('evaluaciones', i.id, {
      persona_id: persona.id,
      pedido_id: pedido,
      evaluadora_id: evaluadora,
      estado: f['Estado'] ?? 'Sin asignar',
      mensaje: f['Mensaje'] ?? null,
      modalidad: f['Modalidad'] ?? null,
      fecha_ingreso: fecha(f['Fecha de ingreso']),
      fecha_entrevista: f['Fecha entrevista'] ?? null,
      fecha_entrega: fecha(f['Fecha de Entrega']),
      recomendacion: f['Recomendación'] ?? null,
      bender_administrado: Boolean(f['Bender administrado']),
      grafico_2_personas_administrado: Boolean(f['Gráfico 2 personas administrado']),
      benziger_administrado: Boolean(primero(f['Benziger'])),
      proyectivo_administrado: lista(f['Tests Proyectivos']).length > 0,
      facturado: Boolean(f['Facturado']),
      pagado: f['Facturación'] === 'Cobrada',
    });
    evaluacionDe[i.id] = evaluacion.id;
    sumo(evaluacion.nuevo ? 'nuevos' : 'saltados', 'expedientes');

    // El Raven viaja con la evaluación: son cuatro números de la misma fila.
    if (f['Raven raw'] !== undefined && f['Raven raw'] !== null && evaluacion.nuevo && deVerdad) {
      await supa('raven', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          evaluacion_id: evaluacion.id,
          raw: f['Raven raw'],
          percentil: f['Raven percentil'] ?? null,
          desvios: f['Raven desvíos'] ?? null,
          resultado: f['Raven resultado'] ?? null,
          origen: 'manual',
        }),
      });
      sumo('nuevos', 'raven');
    }
  }

  // ── 4. Respuestas de manchas ───────────────────────────────────────────────
  const respuestasPorEvaluacion = {};
  let respuestasNuevas = 0;
  for (const r of aRespuestas) {
    const f = r.fields;
    const evaluacion = evaluacionDe[primero(f['Individuo'])];
    if (!evaluacion) {
      sumo('saltados', 'respuestas sin expediente migrado');
      continue;
    }
    const fila = {
      evaluacion_id: evaluacion,
      test: f['Test'] ?? 'Rorschach',
      lamina: f['Lámina'] ?? null,
      n_respuesta: f['N° rta'] ?? null,
      localizacion: f['Loc. + DQ'] ?? null,
      n_localizacion: f['N° loc.'] ?? null,
      determinantes: lista(f['Determinantes']),
      fq: f['FQ'] ?? null,
      contenidos: lista(f['Contenidos']),
      cc_ee: lista(f['CC.EE']),
      par: Boolean(f['Par']),
      popular: Boolean(f['P']),
      agc: Boolean(f['AgC']),
      sl: Boolean(f['SL']),
      z: f['Pje Z'] ?? null,
    };
    const { nuevo } = await poner('rorschach_respuestas', r.id, fila);
    sumo(nuevo ? 'nuevos' : 'saltados', 'respuestas de manchas');
    if (nuevo) {
      respuestasNuevas++;
      (respuestasPorEvaluacion[evaluacion] ??= []).push(r.id);
    }
  }

  // ── 5. Benziger ────────────────────────────────────────────────────────────
  for (const b of aBenziger) {
    const f = b.fields;
    const evaluacion = evaluacionDe[primero(f['Candidato'])];
    if (!evaluacion) {
      sumo('saltados', 'benziger sin expediente migrado');
      continue;
    }
    const previas =
      evaluacion === '(ensayo)'
        ? []
        : await supa(`benziger?select=evaluacion_id&evaluacion_id=eq.${evaluacion}&limit=1`);
    if (previas[0]) {
      sumo('saltados', 'benziger');
      continue;
    }
    const cuadrante = (base) =>
      Object.fromEntries(
        ['FI', 'BI', 'BD', 'FD'].map((q) => [`${base}_${q.toLowerCase()}`, f[`${etiqueta(base)} ${q}`] ?? null])
      );
    const estres = Object.fromEntries(
      Array.from({ length: 20 }, (_, n) => {
        const k = String(n + 1).padStart(2, '0');
        const campo = Object.keys(f).find((x) => x.startsWith(`EV${k} `));
        return [`ev${k}`, campo ? (f[campo] ?? 0) : 0];
      })
    );
    if (deVerdad) {
      await supa('benziger', {
        method: 'POST',
        body: JSON.stringify({
          evaluacion_id: evaluacion,
          cuadrantes: {
            ...cuadrante('trabajo'),
            ...cuadrante('tiempolibre'),
            ...cuadrante('autopercepcion'),
            ...cuadrante('total_adulto'),
            ...cuadrante('total_joven'),
            nivel_alerta_adulto: f['Nivel de alerta Adulto'] ?? null,
            nivel_alerta_joven: f['Nivel de alerta Joven'] ?? null,
          },
          estres: { ...estres, puntos_estres: f['Puntos de estrés'] ?? null },
          adjetivos: {
            imagen_elegida: f['Imagen elegida'] ?? null,
            adjetivo_elegido: f['Adjetivo elegido'] ?? null,
            q56_pos: f['Q56 POS'] ?? null,
            q56_det: f['Q56 DET'] ?? null,
            q56_neg: f['Q56 NEG'] ?? null,
            q56_adjetivos: f['Q56 adjetivos'] ?? null,
            q56_ponderado: f['Q56 ponderado'] ?? null,
            q57_pos: f['Q57 POS'] ?? null,
            q57_det: f['Q57 DET'] ?? null,
            q57_neg: f['Q57 NEG'] ?? null,
            q57_adjetivos: f['Q57 adjetivos'] ?? null,
            q57_ponderado: f['Q57 ponderado'] ?? null,
            tot_pos: f['TOT POS'] ?? null,
            tot_det: f['TOT DET'] ?? null,
            tot_neg: f['TOT NEG'] ?? null,
          },
          abiertas: {
            q4_tiempo_libre: f['Q4 tiempo libre'] ?? null,
            q21_disfruta: f['Q21 disfruta'] ?? null,
            q22_no_disfruta: f['Q22 no disfruta'] ?? null,
            q61_hace_bien_no_gusta: f['Q61 hace bien no gusta'] ?? null,
          },
          resumen: f['Resumen Benziger'] ?? null,
        }),
      });
    }
    sumo('nuevos', 'benziger');
  }

  // ── 6. Sumarios: se recalculan y se comparan ───────────────────────────────
  //
  // Se calculan los que faltan, no los de esta corrida: si algo se cortó antes,
  // volver a correr el script tiene que terminar el trabajo, y las respuestas ya
  // están cargadas aunque su sumario no.
  if (deVerdad) {
    const conRespuestas = new Set(
      (await supa('rorschach_respuestas?select=evaluacion_id')).map((r) => r.evaluacion_id)
    );
    const conSumario = new Set(
      (await supa('sumario_exner?select=evaluacion_id')).map((r) => r.evaluacion_id)
    );
    const faltan = [...conRespuestas].filter((id) => !conSumario.has(id));
    const cookie = env.OS_CLAVE
      ? `os_sesion=${createHash('sha256').update(`campos-os:${env.OS_CLAVE}`).digest('hex')}`
      : '';
    for (const id of faltan) {
      const r = await fetch(`${OS}/api/os/sumario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ evaluacionId: id }),
      });
      if (!r.ok) cuenta.avisos.push(`Sumario de ${id}: ${r.status} ${await r.text()}`);
      else sumo('nuevos', 'sumarios calculados');
    }
  } else if (respuestasNuevas > 0) {
    sumo('nuevos', 'sumarios, uno por expediente con respuestas');
  }

  // ── 7. Facturas ────────────────────────────────────────────────────────────
  const emisorDe = Object.fromEntries(
    (await supa('emisores?select=id,evaluadoras(nombre)')).map((e) => [e.evaluadoras?.nombre, e.id])
  );
  for (const fa of aFacturas) {
    const f = fa.fields;
    const empresa = empresaDe[primero(f['Cliente'])];
    const emisor = emisorDe[nombreEvaluadora[primero(f['Evaluadora'])]];
    if (!empresa || !emisor) {
      sumo('saltados', 'facturas sin cliente o sin emisora');
      continue;
    }
    const cubiertas = lista(f['Candidatos']).map((c) => evaluacionDe[c]).filter(Boolean);
    const { id, nuevo } = await poner('facturas', fa.id, {
      origen: 'airtable',
      emisor_id: emisor,
      empresa_id: empresa,
      numero: f['Número'] ? Number(String(f['Número']).replace(/\D/g, '')) || null : null,
      fecha: fecha(f['Fecha de emisión']) ?? fecha(f['Fecha de cobro']),
      imp_total: f['Importe a mano'] ?? null,
      moneda: f['Moneda'] === 'USD' ? 'DOL' : 'PES',
      estado: f['Estado Factura'] === 'Anulada' ? 'anulada' : 'emitida',
      cobrada_at: fecha(f['Fecha de cobro']),
    });
    sumo(nuevo ? 'nuevos' : 'saltados', 'facturas');
    if (nuevo && deVerdad && cubiertas.length > 0) {
      // Una evaluación entra en una sola factura, y eso la base lo hace
      // cumplir: si alguna ya está en otra, el renglón se saltea en vez de
      // tumbar la migración entera por un comprobante repetido.
      const yaEn = new Set(
        (
          await supa(
            `factura_items?select=evaluacion_id&evaluacion_id=in.(${cubiertas.join(',')})`
          )
        ).map((x) => x.evaluacion_id)
      );
      const entran = cubiertas.filter((x) => !yaEn.has(x));
      for (const x of cubiertas) if (yaEn.has(x)) cuenta.avisos.push(`Ya estaba facturada: ${x}`);
      if (entran.length > 0) {
        await supa('factura_items', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(
            entran.map((evaluacionId) => ({
              factura_id: id,
              evaluacion_id: evaluacionId,
              descripcion: 'Evaluación psicotécnica',
              cantidad: 1,
              importe: null,
            }))
          ),
        });
      }
    }
  }

  // ── El parte ───────────────────────────────────────────────────────────────
  console.log('Traído:');
  for (const [k, v] of Object.entries(cuenta.nuevos)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log('\nYa estaba o no corresponde:');
  for (const [k, v] of Object.entries(cuenta.saltados)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  if (cuenta.avisos.length > 0) {
    console.log('\nPara mirar:');
    for (const a of cuenta.avisos) console.log(`  · ${a}`);
  }
  if (!deVerdad) console.log('\n(Ensayo: no se escribió nada. Correr con --de-verdad.)');
}

/** El nombre del bloque en Airtable, que no es el de la columna en Supabase. */
function etiqueta(base) {
  return {
    trabajo: 'Trabajo',
    tiempolibre: 'Tiempo Libre',
    autopercepcion: 'Autopercepción',
    total_adulto: 'Total Adulto',
    total_joven: 'Total Joven',
  }[base];
}

main().catch((e) => {
  console.error('\nSe cortó:', e.message);
  process.exit(1);
});
