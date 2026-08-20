import type { Metadata } from 'next';
import './os.css';

export const metadata: Metadata = {
  title: 'Campos OS',
  description: 'El sistema interno de Campos HR.',
  robots: { index: false, follow: false },
};

/**
 * El tema se decide antes de pintar.
 *
 * Corre sincrónico en el HTML: lee lo guardado y, si no hay nada, sigue al
 * sistema operativo. Sin esto, entrar de noche muestra el fondo claro un
 * instante y recién después se oscurece.
 */
const TEMA = `
(function () {
  try {
    var h = document.documentElement;
    var t = localStorage.getItem('os-tema');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    h.setAttribute('data-os-tema', t);
    if (localStorage.getItem('os-lateral') === 'compacta') h.setAttribute('data-os-lateral', 'compacta');
  } catch (e) {}
})();
`;

export default function LayoutOS({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      {children}
    </>
  );
}
