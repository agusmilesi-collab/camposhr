/**
 * El candidato, en los contactos de Google de su evaluadora.
 *
 * Al citar, la evaluadora le escribe por WhatsApp a alguien que no tiene
 * agendado: en su teléfono la conversación queda con un número y, una semana
 * después, no sabe de quién es. Cuando toca el WhatsApp de la tarjeta, el OS
 * crea el contacto en su cuenta de Google (nombre y apellido, teléfono, correo
 * y "Candidato" de la empresa que lo pidió), y el teléfono lo trae solo.
 *
 * Usa la misma conexión que el calendario (`lib/google-calendario.ts`), con un
 * permiso más. **Solo crea**: no lee, no modifica ni borra los contactos que
 * la evaluadora ya tiene. Para no duplicar, anota en `google_contactos` cuál
 * creó para cada persona en la cuenta de cada una.
 *
 * No tira nunca: es un favor que se hace de paso, y si falla la evaluadora
 * igual tiene que poder escribirle.
 */

import 'server-only';
import { select, upsert } from '@/lib/supabase';
import { accesoDe } from '@/lib/google-calendario';
import { partesDePersona } from '@/lib/personas';

const CREAR = 'https://people.googleapis.com/v1/people:createContact';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fila = {
  evaluadora_id: string | null;
  persona_id: string;
  personas: {
    nombre: string;
    nombre_pila: string | null;
    apellido: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  pedidos: { empresas: { nombre: string } | null } | null;
};

/** El teléfono como lo guarda un contacto: con el país, igual que para WhatsApp. */
function conPais(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '').replace(/^0+/, '');
  return `+${digitos.length === 10 ? `549${digitos}` : digitos}`;
}

export type Agendado = 'creado' | 'ya-estaba' | 'sin-permiso' | 'sin-datos' | 'fallo';

export async function agendarContacto(evaluacionId: string): Promise<Agendado> {
  try {
    if (!UUID.test(evaluacionId)) return 'sin-datos';
    const [e] = await select<Fila>(
      'evaluaciones',
      'select=evaluadora_id,persona_id,personas(nombre,nombre_pila,apellido,telefono,email),pedidos(empresas(nombre))' +
        `&id=eq.${evaluacionId}&limit=1`
    );
    const telefono = e?.personas?.telefono?.trim();
    const nombre = e?.personas?.nombre?.trim();
    if (!e || !e.evaluadora_id || !telefono || !nombre) return 'sin-datos';

    // Las conexiones de antes de este permiso no lo tienen: no se intenta.
    const [conexion] = await select<{ contactos: boolean }>(
      'google_calendario',
      `select=contactos&evaluadora_id=eq.${e.evaluadora_id}&limit=1`
    );
    if (!conexion?.contactos) return 'sin-permiso';

    const [previo] = await select<{ recurso: string }>(
      'google_contactos',
      `select=recurso&evaluadora_id=eq.${e.evaluadora_id}&persona_id=eq.${e.persona_id}&limit=1`
    );
    if (previo) return 'ya-estaba';

    const acceso = await accesoDe(e.evaluadora_id);
    if (!acceso) return 'sin-permiso';

    // Nombres y apellido por separado, que es como los ordena y los muestra
    // el teléfono. Salen de los dos campos de la persona, y de la regla de
    // `partesDelNombre` en las que se cargaron con uno solo. La empresa va como organización y "Candidato" como cargo,
    // que es lo que el contacto muestra debajo del nombre.
    const { nombres, apellido } = partesDePersona(e.personas ?? { nombre });
    const empresa = e.pedidos?.empresas?.nombre?.trim();
    const res = await fetch(CREAR, {
      method: 'POST',
      headers: { Authorization: `Bearer ${acceso}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        names: [{ givenName: nombres, familyName: apellido }],
        phoneNumbers: [{ value: conPais(telefono), type: 'mobile' }],
        ...(e.personas?.email ? { emailAddresses: [{ value: e.personas.email }] } : {}),
        organizations: [{ title: 'Candidato', ...(empresa ? { name: empresa } : {}) }],
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[google] no se pudo crear el contacto', res.status, await res.text());
      return res.status === 403 ? 'sin-permiso' : 'fallo';
    }
    const { resourceName } = (await res.json()) as { resourceName?: string };
    await upsert(
      'google_contactos',
      { evaluadora_id: e.evaluadora_id, persona_id: e.persona_id, recurso: resourceName ?? '' },
      'evaluadora_id,persona_id',
      false
    );
    return 'creado';
  } catch (err) {
    console.error('[google] no se pudo agendar el contacto', err);
    return 'fallo';
  }
}
