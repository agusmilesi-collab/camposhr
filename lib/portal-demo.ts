/**
 * Cliente de prueba del portal y del armado de informes, con datos inventados.
 *
 * Es la única empresa sobre la que se puede probar sin tocar Airtable ni
 * exponer candidatos reales. Solo responde fuera de producción
 * (`NODE_ENV !== 'production'`), así que el token no da acceso a nada en
 * clientes.camposhr.com y la fila tampoco aparece en el /informes desplegado.
 *
 * Se abre en http://localhost:3000/p/demo-cliente-prueba, y figura en
 * http://localhost:3000/informes marcada como prueba.
 *
 * Los cinco pedidos cubren a propósito los estados que el portal sabe mostrar:
 * candidato por citar, por entrevistar, por analizar, en seguimiento y entregado
 * con informe, más una búsqueda todavía sin candidatos.
 */
import { getDatosClientePorEmpresa, type DatosCliente } from './airtable';

export const TOKEN_DEMO = 'demo-cliente-prueba';

/** La empresa gemela en Airtable, cargada el 13/8/2026. No tiene "Token portal"
 *  a propósito: sin token no figura en el listado de accesos ni se abre desde
 *  clientes.camposhr.com. Es donde caen los pedidos que se cargan probando. */
export const EMPRESA_DEMO = 'recX2DYWlVzjLoAXT';

/**
 * Informes escritos a mano para los candidatos de prueba de Airtable.
 *
 * El circuito de verdad va a traer el PDF que la psicóloga sube al campo
 * "Informe PDF" del candidato. Mientras eso no está abierto, este mapa deja ver
 * cómo se lee un informe entero desde el portal: la clave es el ID del registro
 * en `Individuo` y el valor, el archivo servido desde `public/`.
 */
export const INFORMES_PRUEBA: Record<string, string> = {
  recJpClFogV09rZsX: '/informes-prueba/bruno-alsina.html',
};

export const NOMBRE_DEMO = 'Distribuidora Andina';

/** En el portal el nombre lleva la aclaración; en /informes la lleva el sello
 *  de la fila, así que ahí alcanza con el nombre solo. */
export const NOMBRE_DEMO_PORTAL = `${NOMBRE_DEMO} (prueba)`;

export function esDemo(token: string): boolean {
  return token === TOKEN_DEMO && process.env.NODE_ENV !== 'production';
}

export function datosDemo(): DatosCliente {
  return {
    empresa: NOMBRE_DEMO_PORTAL,
    empresaId: EMPRESA_DEMO,
    documentos: [],
    busquedas: [
      {
        id: 'demo-p1',
        puesto: 'Jefe de Depósito',
        estado: 'En curso',
        area: 'Operaciones',
        seniority: 'Jefatura',
        fecha: '2026-07-28',
        candidatos: [
          {
            id: 'demo-c1',
            nombre: 'Martín Aguirre',
            estado: 'Por entrevistar',
            evaluadora: 'Lorena Campos',
            fechaEntrevista: '2026-08-14T17:00:00.000Z',
            fechaEntrega: '2026-08-20',
            modalidad: 'Online',
            recomendacion: null,
            facturado: false,
            pagado: false,
            tieneInforme: false,
          },
          {
            id: 'demo-c2',
            nombre: 'Carolina Ferreyra',
            estado: 'Por citar',
            evaluadora: null,
            fechaEntrevista: null,
            fechaEntrega: null,
            modalidad: null,
            recomendacion: null,
            facturado: false,
            pagado: false,
            tieneInforme: false,
          },
          {
            id: 'demo-c3',
            nombre: 'Nicolás Paz',
            estado: 'Por analizar',
            evaluadora: 'Lorena Campos',
            fechaEntrevista: '2026-08-05T14:30:00.000Z',
            fechaEntrega: '2026-08-13',
            modalidad: 'Presencial',
            recomendacion: null,
            facturado: true,
            pagado: false,
            tieneInforme: false,
          },
        ],
      },
      {
        id: 'demo-p2',
        puesto: 'Analista de Compras',
        estado: 'En curso',
        area: 'Administración',
        seniority: 'Semi Senior',
        fecha: '2026-07-15',
        candidatos: [
          {
            id: 'demo-c4',
            nombre: 'Sofía Maidana',
            estado: 'Entregado',
            evaluadora: 'Lucila Campos',
            fechaEntrevista: '2026-07-22T13:00:00.000Z',
            fechaEntrega: '2026-07-29',
            modalidad: 'Online',
            recomendacion: 'Apto',
            facturado: true,
            pagado: true,
            tieneInforme: true,
          },
          {
            id: 'demo-c5',
            nombre: 'Ezequiel Godoy',
            estado: 'Seguimiento',
            evaluadora: 'Lucila Campos',
            fechaEntrevista: '2026-07-23T16:00:00.000Z',
            fechaEntrega: '2026-07-30',
            modalidad: 'Presencial',
            recomendacion: null,
            facturado: true,
            pagado: false,
            tieneInforme: false,
          },
        ],
      },
      {
        id: 'demo-p3',
        puesto: 'Supervisor de Mantenimiento Mecánico',
        estado: 'Cerrado',
        area: 'Operaciones',
        seniority: 'Supervisión',
        fecha: '2026-06-19',
        candidatos: [
          {
            id: 'demo-c6',
            nombre: 'Julieta Escobar',
            estado: 'Entregado',
            evaluadora: 'Lorena Campos',
            fechaEntrevista: '2026-06-26T15:00:00.000Z',
            fechaEntrega: '2026-07-02',
            modalidad: 'Presencial',
            recomendacion: 'Apto con observaciones',
            facturado: true,
            pagado: true,
            tieneInforme: true,
          },
          {
            id: 'demo-c7',
            nombre: 'Agustín Ignacio Peliche',
            estado: 'Entregado',
            evaluadora: 'Lucila Campos',
            fechaEntrevista: '2026-06-27T18:30:00.000Z',
            fechaEntrega: '2026-07-03',
            modalidad: 'Online',
            recomendacion: 'No apto',
            facturado: true,
            pagado: false,
            tieneInforme: true,
          },
        ],
      },
      {
        id: 'demo-p5',
        puesto: 'Coordinador de Logística',
        estado: 'En curso',
        area: 'Operaciones',
        seniority: 'Jefatura',
        fecha: '2026-08-06',
        candidatos: [],
      },
    ],
  };
}

/**
 * Lo inventado más lo que haya cargado en Airtable para la empresa de prueba.
 *
 * Los pedidos que entran por el formulario van a Airtable, así que sin esto se
 * cargarían y no se verían. Van primero, que es donde el que está probando los
 * busca. Si Airtable no responde, quedan los inventados y la pantalla no se
 * cae por una prueba.
 */
export async function datosDemoConAirtable(): Promise<DatosCliente> {
  const base = datosDemo();
  try {
    const real = await getDatosClientePorEmpresa(EMPRESA_DEMO);
    if (!real) return base;
    return {
      empresa: base.empresa,
      empresaId: EMPRESA_DEMO,
      documentos: real.documentos,
      busquedas: [...real.busquedas, ...base.busquedas],
    };
  } catch {
    return base;
  }
}

/** Página de muestra que reemplaza al PDF cuando se mira el cliente de prueba. */
export function informeDemo(nombre: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Informe de prueba</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f6f5f2; color: #16202b;
         display: flex; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; padding: 24px; }
  div { max-width: 420px; text-align: center; }
  h1 { font-weight: 400; font-size: 1.5rem; margin: 0 0 10px; }
  p { color: #7b7770; font-size: 0.9rem; line-height: 1.6; }
</style></head>
<body><div>
  <h1>Informe de ${nombre}</h1>
  <p>Este es el cliente de prueba: acá se abre el PDF del informe que está
  cargado en Airtable, en el campo "Informe PDF" del candidato.</p>
</div></body></html>`;
}
