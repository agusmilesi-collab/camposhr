import { notFound } from 'next/navigation';
import { datosClienteDeSupabase, empresaDelToken } from '@/lib/portal-supabase';
import { getDatosCliente } from '@/lib/airtable';
import { datosDemoConAirtable, esDemo } from '@/lib/portal-demo';
import { alcanceYPrecios } from '@/lib/precio-portal';
import { quienesPiden } from '@/lib/contactos';
import { DEL_JEFE, DEL_PUESTO } from '@/lib/pedido-campos';
import Pedido from './Pedido';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Pedir una evaluación',
  robots: { index: false, follow: false },
};

/**
 * Pedir una evaluación, en su propia pantalla.
 *
 * Vivía en un cajón lateral del portal. Un cajón dice "esto es una tarea menor,
 * seguí con lo que estabas", y acá el cliente está decidiendo una compra de
 * cientos de miles de pesos por candidato: necesita el ancho para leer lo que
 * incluye cada batería, y el total a la vista mientras elige.
 *
 * **La fricción es el problema a vencer, no el detalle.** Antes de esto el
 * cliente mandaba un WhatsApp con el CV y un audio: cero decisiones. Por eso lo
 * único que se exige es la búsqueda, el nombre de cada candidato y cómo
 * contactarlo. El perfil del puesto, que es lo que permite medir a la persona
 * contra el contexto donde va a entrar y no solo en abstracto, se ofrece y se
 * explica, y se puede saltear.
 */
export default async function PedirEvaluacion({ params }: { params: { token: string } }) {
  const demo = esDemo(params.token);
  const empresa = demo ? null : await empresaDelToken(params.token);

  const datos = demo
    ? await datosDemoConAirtable()
    : ((await datosClienteDeSupabase(params.token)) ?? (await getDatosCliente(params.token)));
  if (!datos) notFound();

  const [alcance, contactos] = await Promise.all([
    alcanceYPrecios(),
    empresa ? quienesPiden(empresa.id) : Promise.resolve([]),
  ]);

  return (
    <Pedido
      token={params.token}
      empresa={datos.empresa}
      busquedas={datos.busquedas}
      alcance={alcance}
      contactos={contactos}
      delPuesto={DEL_PUESTO}
      delJefe={DEL_JEFE}
    />
  );
}
