import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** El manual vive en Documentos, pestaña Manual. La dirección vieja llega ahí. */
export default function Manual() {
  redirect('/centro/documentos?ver=manual');
}
