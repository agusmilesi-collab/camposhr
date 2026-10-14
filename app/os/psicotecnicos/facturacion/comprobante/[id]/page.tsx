import Comprobante from './Comprobante';

export const dynamic = 'force-dynamic';

/**
 * El comprobante en el OS. El documento vive en `Comprobante`, que también usa
 * el portal del inquilino: una sola hoja, para que lo que ve el equipo y lo que
 * descarga el cliente sean el mismo papel.
 */
export default async function Pagina(props: { params: Promise<{ id: string }> }) {
 const params = await props.params;
 return <Comprobante id={params.id} puedeEmitir />;
}
