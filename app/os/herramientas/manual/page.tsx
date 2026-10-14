import Shell from '../../Shell';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';
import { loQueRige } from '@/lib/informe';
import { bandasDe } from '@/lib/exigencia';
import { manualDe, RESPUESTAS_MINIMAS, type IndicadorDelManual } from '@/lib/competencias';

export const metadata = { title: 'Manual del velocímetro — Campos OS' };

/**
 * El manual de las evaluadoras: cómo se arma cada número del velocímetro.
 *
 * Las tablas de competencias salen del motor (`manualDe`) con lo guardado en
 * Configuración, y las bandas de la exigencia predeterminada: cuando cambia un
 * corte o un peso, esto cambia solo. Lo que está escrito a mano son las normas
 * de cada test y los pasos de trabajo, que no viven en el código.
 */
export default async function Manual() {
  const [yo, cuentas, rige] = await Promise.all([quienSoy(), cuentasDeLaBarra(), loQueRige()]);
  const exigencia = rige.exigencias.find((e) => e.predeterminada) ?? rige.exigencias[0];
  const bandas = bandasDe(exigencia).slice().reverse();

  return (
    <Shell titulo="Manual del velocímetro" identidad={yo.nombre} cuentas={cuentas}>
      <div className="os-encabezado">
        <h1>Manual del velocímetro</h1>
        <p>
          Cómo se calcula cada competencia, con qué normas y qué revisar antes de firmar. Las
          tablas salen del sistema: si cambia un corte o un peso, esta página cambia con él.
        </p>
      </div>

      <div className="os-panel os-manual">
        <div className="os-panel-top">
          <h2>1. Qué normas usa cada test</h2>
        </div>
        <ul>
          <li>
            <strong>Rorschach.</strong> Se codifica con el Sistema Comprehensivo y la tabla de
            calidad formal de Exner. Los cortes siguen la norma argentina de adultos no pacientes
            (Lunazzi y otros, 2007, 506 casos): la media más y menos un desvío. Siete índices
            siguen con Exner: GHR : PHR, COP / AG y CDI, porque su corte es una regla de
            interpretación; M− y Fd, porque la norma argentina da el mismo corte; Lambda, porque
            su distribución es muy despareja; y contenidos H, porque su rango cambia con R y con
            el estilo.
          </li>
          <li>
            <strong>Zulliger.</strong> Se codifica con el Sistema Comprehensivo y se interpreta con
            las normas de Zdunic para selección de personal (500 protocolos de Buenos Aires).
          </li>
          <li>
            <strong>Raven.</strong> Entra en Habilidad cognitiva por la cantidad de aciertos, en
            línea continua. Sin Raven, Habilidad cognitiva no lleva número.
          </li>
        </ul>
      </div>

      <div className="os-panel os-manual">
        <div className="os-panel-top">
          <h2>2. Qué significa el número</h2>
        </div>
        <ul>
          <li>
            Cada indicador cae en un nivel: <strong>bajo vale 25</strong>,{' '}
            <strong>medio vale 50</strong> y <strong>alto vale 100</strong>.
          </li>
          <li>
            Hay dos clases de indicador. Un <strong>recurso</strong> en su mejor nivel vale 100.
            Uno <strong>dentro de lo esperable</strong> vale 50 aunque esté perfecto: dice que no
            apareció nada en contra, y no que la persona tenga un recurso.
          </li>
          <li>
            El puntaje es el promedio de los indicadores, cada uno con su peso. Una persona con
            todo dentro de lo esperable y ningún recurso queda en 50. Para subir de ahí necesita
            recursos; con un solo indicador en contra, baja de 50.
          </li>
          <li>
            Las bandas que rigen hoy ({exigencia.nombre}):{' '}
            {bandas
              .map((b) =>
                b.desde === 0 ? `${b.nombre} por debajo de ${exigencia.adecuado}` : `${b.nombre} de ${b.desde} a ${b.hasta}`
              )
              .join('; ')}
            .
          </li>
        </ul>
      </div>

      {(['Rorschach', 'Zulliger'] as const).map((test) => (
        <div className="os-panel os-manual" key={test}>
          <div className="os-panel-top">
            <h2>3. Las competencias en {test}</h2>
          </div>
          {manualDe(test, rige).map((c) => (
            <section key={c.competencia} className="os-manual-competencia">
              <h3>{c.competencia}</h3>
              <p className="os-panel-nota">{c.mide}</p>
              <div className="os-tabla-marco">
                <table className="os-tabla">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Clase</th>
                      <th>Peso</th>
                      <th>Dónde corta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.indicadores.map((i) => (
                      <tr key={i.nombre}>
                        <td>
                          <strong>{i.nombre}</strong>
                          <span className="os-manual-mide">{i.mide}</span>
                        </td>
                        <td>{clase(i)}</td>
                        <td>{i.peso}</td>
                        <td>{i.corte}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ))}

      <div className="os-panel os-manual">
        <div className="os-panel-top">
          <h2>4. Antes de firmar</h2>
        </div>
        <ul>
          <li>
            En la pestaña Informe de la ficha, tocar <strong>Click para ver indicadores</strong>.
            Cada competencia muestra de qué indicadores sale su número.
          </li>
          <li>
            Si al lado del puntaje dice, por ejemplo, &quot;bajaría hasta 81 con un dato distinto
            en Lambda, W : M o T&quot;, el número depende de cómo quedaron codificados esos datos.
            Conviene revisar esas respuestas en el protocolo antes de firmar.
          </li>
          <li>
            Mirar que el test cargado sea el de la batería: un Zulliger leído como Rorschach usa
            otras normas.
          </li>
        </ul>
      </div>

      <div className="os-panel os-manual">
        <div className="os-panel-top">
          <h2>5. Cuándo una competencia no lleva número</h2>
        </div>
        <ul>
          <li>
            <strong>Protocolo corto:</strong> con menos de {RESPUESTAS_MINIMAS.Rorschach} respuestas
            en Rorschach o de {RESPUESTAS_MINIMAS.Zulliger} en Zulliger no se puntúa ninguna
            competencia del test de manchas.
          </li>
          <li>
            <strong>Falta un dato imprescindible:</strong> Habilidad cognitiva sin Raven.
          </li>
          <li>
            <strong>Faltan dos o más indicadores</strong> de la misma competencia: el informe dice
            que falta, en lugar de dar un número apoyado en la mitad del protocolo.
          </li>
        </ul>
      </div>

      <div className="os-panel os-manual">
        <div className="os-panel-top">
          <h2>6. Si no están de acuerdo con un puntaje</h2>
        </div>
        <ul>
          <li>
            Mandarle a Agustín el nombre de la persona, la competencia, el puntaje que pondrían y
            por qué. Con eso se revisa el caso contra los indicadores y, si hace falta, se cambia
            el corte o el peso para todos.
          </li>
          <li>
            No corregir el número a mano en el informe: el siguiente caso igual saldría con el
            mismo error.
          </li>
        </ul>
      </div>
    </Shell>
  );
}

function clase(i: IndicadorDelManual): string {
  if (i.clase === 'sin peso') return 'No pesa';
  const base = i.clase === 'recurso' ? 'Recurso' : 'Dentro de lo esperable';
  return i.imprescindible ? `${base} (imprescindible)` : base;
}
