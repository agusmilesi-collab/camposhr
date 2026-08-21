/**
 * Qué se le administró además de las manchas, tal como quedó en la entrevista.
 *
 * Las manchas no se listan acá: lo que se hizo con ellas está en su propia
 * pestaña, codificado respuesta por respuesta, y repetir que se tomaron no
 * agregaba nada.
 *
 * El Bender y el gráfico de dos personas no producen puntajes en el OS: lo que
 * queda de ellos es si se tomaron y lo que la evaluadora anotó mientras la
 * persona dibujaba.
 *
 * Acá no se editan. Las dos cosas se cargan en la hoja de la entrevista, con la
 * persona enfrente, y esta pantalla las muestra para escribir el informe. Una
 * observación de administración se escribe en el momento o no existe: lo que se
 * corrigiera semanas después sería un recuerdo, y entraría al informe con el
 * mismo peso que lo observado.
 */

export default function Administrados({
  id,
  bender,
  benderNotas,
  benderHoja,
  grafico,
  graficoNotas,
  graficoDibujo,
}: {
  id: string;
  bender: boolean;
  benderNotas: string | null;
  /** El nombre de lo que se subió, o null si todavía no hay nada que ver. */
  benderHoja: string | null;
  grafico: boolean;
  graficoNotas: string | null;
  graficoDibujo: string | null;
}) {
  // En el orden en que se administran.
  const TESTS = [
    { texto: 'Bender', marca: 'bender' as const },
    { texto: 'Gráfico 2 personas', marca: 'grafico' as const },
  ];
  const valores = {
    bender: { puesto: bender, notas: benderNotas, archivo: benderHoja, ruta: 'bender' },
    grafico: { puesto: grafico, notas: graficoNotas, archivo: graficoDibujo, ruta: 'grafico' },
  };

  return (
    <div className="os-administrados">
      {TESTS.map((t) => {
        const v = valores[t.marca];
        return (
          <div key={t.marca} className="os-administrado-fijo">
            <span className="os-dato-rotulo">{t.texto}</span>
            <span className={`os-sello-estado ${v.puesto ? 'os-verde' : 'os-gris'}`}>
              {v.puesto ? 'Tomado' : 'No se tomó'}
            </span>
            {/* Lo que dibujó, al lado del estado: se mira mientras se escribe
                el informe, que es lo que se hace en esta pestaña. */}
            {v.archivo ? (
              <a
                className="os-boton"
                href={`/api/os/${v.ruta}?id=${id}`}
                target="_blank"
                rel="noreferrer"
                title={v.archivo}
              >
                Ver
              </a>
            ) : (
              <span className="os-administrado-sin">—</span>
            )}
            <span className={v.notas ? 'os-administrado-notas' : 'os-administrado-sin'}>
              {v.notas || 'Sin observaciones'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
