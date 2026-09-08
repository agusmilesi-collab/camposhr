import type { Metadata } from 'next';
import './centro.css';

export const metadata: Metadata = {
  title: 'Centro Integral Santiago',
  description: 'Reservá tu consultorio.',
  robots: { index: false, follow: false },
};

export default function LayoutCentro({ children }: { children: React.ReactNode }) {
  return <div className="centro">{children}</div>;
}
