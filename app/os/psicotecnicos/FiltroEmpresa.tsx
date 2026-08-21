'use client';

/**
 * Con qué cliente se está trabajando.
 *
 * Es un filtro de pantalla y no un borrado: las evaluaciones de los demás
 * clientes siguen donde estaban. Por eso la pantalla dice siempre cuántas está
 * escondiendo, y con un clic se ven todas.
 *
 * Mientras se construye el sistema arranca en Distribuidora Andina, el cliente
 * inventado, así se trabaja sobre doce filas y no sobre setenta y cinco.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Desplegable from '@/app/os/Desplegable';
import { COOKIE_EMPRESA, TODAS } from '@/lib/filtro-empresa';

function guardar(valor: string) {
  const anio = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_EMPRESA}=${encodeURIComponent(valor)}; path=/; max-age=${anio}; samesite=lax`;
}

export default function FiltroEmpresa({
  empresas,
  actual,
  ocultas,
}: {
  empresas: string[];
  /** El nombre elegido, o la constante TODAS. */
  actual: string;
  ocultas: number;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  function cambiar(v: string) {
    guardar(v);
    empezar(() => router.refresh());
  }

  return (
    <div className="os-barra-acciones os-barra-filtro">
      <label className="os-tilde" style={{ gap: 10 }}>
        <span className="os-dato-rotulo">Cliente</span>
        <Desplegable
          valor={actual}
          opciones={[
            { valor: TODAS, texto: 'Todos' },
            ...empresas.map((e) => ({ valor: e, texto: e })),
          ]}
          alElegir={cambiar}
          deshabilitado={pendiente}
          etiqueta="Filtrar por cliente"
        />
      </label>

      {ocultas > 0 && (
        <span className="os-columna-nota">
          {ocultas} {ocultas === 1 ? 'evaluación' : 'evaluaciones'} de otros clientes sin mostrar.{' '}
          <button type="button" className="os-enlace-boton" onClick={() => cambiar(TODAS)}>
            Ver todas
          </button>
        </span>
      )}
    </div>
  );
}
