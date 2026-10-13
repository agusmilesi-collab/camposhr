# Velocímetro: lo que se decidió distinto a las psicólogas y lo que falta

Estado al 13/10/2026. Sale de comparar el motor contra 73 informes que Lucila y
Lorena escribieron a mano, y de sus respuestas del 9/10 y del 13/10.

Los nombres de las personas que se mencionan como pendientes están fuera de
este repositorio, que es público:
`~/Documents/camposhr-privado/velocimetro/pendientes-con-nombres.md`.

## Dónde estamos

| Medida | 8/10/2026 | 13/10/2026 |
| --- | --- | --- |
| Puntajes en la misma banda que sus informes | 48 % | 71 % (275 de 387) |
| Diferencia media con sus puntajes | 11,2 puntos | 4,1 puntos |
| Diferencias de más de 20 puntos | sin medir | 24 de 387 |

Banda es Bajo (menos de 35), Medio (35 a 64) o Alto (65 o más).

**El piso.** Moviendo pesos, la distancia promedio con sus puntajes no baja de
unos 10 puntos en ninguna competencia. Ellas puntuaban a ojo, de a 5 y de a 10,
y ese es el margen de su propia variación. Coincidir más que eso sería copiar
su variación y no su criterio.

## El criterio con el que se decide

Lo fijó Agustín el 13/10/2026:

1. **El sistema aporta objetividad.** Sus puntajes a mano son una referencia
   para quedar cerca, no la verdad a igualar punto por punto.
2. **La salida es siempre la misma aunque cambie la entrada.** Todo velocímetro
   va de 25 a 100, sea Rorschach o Zulliger, con o sin Raven, con o sin
   análisis discursivo.
3. **A las psicólogas se les pregunta criterio clínico.** La escala, los pesos,
   qué hacer cuando falta un test y cómo leer un texto ambiguo se deciden acá.

## Lo que se hizo distinto a lo que escribió Lorena

Cada punto dice qué pidió, qué se hizo y por qué. Los dos primeros son los que
hay que reconfirmar con ella.

### A reconfirmar

| # | Lo que escribió | Lo que se hizo | Por qué |
| --- | --- | --- | --- |
| 1 | Ma : Mp: si Mp no supera a Ma + 1, es **positivo** | Es **"dentro de lo esperable"** (vale 50) | Daba positivo en 45 de 46 Zulliger y en 35 de 47 Rorschach. Contado como recurso, dos de cada tres personas caían en Alto en Proactividad |
| 2 | DQ+ y Zf no se usaban en Proactividad: sacarlos | Zf queda en peso 0. **DQ+ sigue, con peso 2** | Sin DQ+ queda un solo recurso (R) y la persona promedio cae en Alto. Con R y DQ+ el promedio baja de 75 a 67, contra 60 de ellas |

### Decididas acá, se le informan

| # | Lo que escribió | Lo que se hizo | Por qué |
| --- | --- | --- | --- |
| 3 | Los velocímetros tienen que llegar a 100 y el máximo no puede cambiar con el test. No eligió cómo | El promedio se lleva del tramo de 25 a su máximo posible, al tramo de 25 a 100, en las seis competencias | Es la única forma de cumplirlo sin deshacer su regla del 30/9 ("dentro de lo esperable" vale 50) |
| 4 | Raven en tres bandas (0 a 20, 21 a 30, 31 a 36), y aparte "considerar puntajes intermedios cerca del 25 y del 30" | De 25 a 30 aciertos sigue en medio y aporta 75 | Con tres bandas, 21 y 30 aciertos recibían lo mismo. El corte en 25 es lectura nuestra de su frase |
| 5 | D y AdjD: mayor que 0 alta, igual a 0 media, menor que 0 baja | Alta con los dos por encima de 0, baja con AdjD negativo, **media en el resto** | No dice qué hacer con AdjD en 0 o más y D negativo. Se dejó en media porque ella definió AdjD como la capacidad habitual |
| 6 | m + Y: "si Y > 1 y m > 2 serán negativo" | En Rorschach, negativo con **cualquiera de las dos** pasada | Se leyó "y" como cada una por su lado. En Zulliger sigue la suma |
| 7 | Su lista pone Zf y Zd en Capacidad intelectual de Rorschach | No vuelven | El 30/9 se sacaron de ahí con ellas para no contarlos dos veces. La lista parece una versión anterior |
| 8 | An+Xy no se informa si la profesión tiene que ver con el cuerpo | No se agregó nada | El sistema no sabe la profesión. La evaluadora borra esa línea en la ficha, que ya se puede |
| 9 | En Rorschach las frases de EA dependen de D y de AdjD | Dependen de AdjD solamente | Un D negativo ya tiene su propia lectura (tensión del momento) |
| 10 | Liderazgo se evalúa en la batería 2, sin análisis discursivo | Ya funcionaba así: se calcula con los seis indicadores restantes | Sin cambio |
| 11 | Los pesos "es más que probable" que difieran de sus informes | Proactividad: R 4, Fd 3, Ma : Mp 2, DQ+ 2, Zf 0, igual en los dos tests. Autogestión en Zulliger: Lambda 3, T 3, W : M 1, Dd 1, EB 1 | En Zulliger W : M da negativo en 39 de 46 personas. Las diferencias de más de 20 puntos bajaron de 18 a 7 en Proactividad y de 10 a 5 en Autogestión |

### Reglas nuevas que ella no pidió

- **Sin medición suficiente, sin puntaje.** Si los indicadores con dato pesan
  menos de la mitad de la competencia, sale sin puntaje y dice qué falta. El
  caso es Habilidad cognitiva sin Raven: con tres indicadores de alarma en
  rango daría 100 sin haber medido razonamiento.
- **Raven de 12 láminas por escalón.** Hasta 7 aciertos bajo, de 8 a 11 medio,
  y 12 aporta 75. Los escalones salen de lo que ellas mismas pusieron en
  Habilidad cognitiva a las trece personas que lo rindieron. Ya no se toma, así
  que no tiene pantalla de carga (`supabase/raven-corto.sql`).

## Lo que falta

### Para Lorena

1. Reconfirmar los puntos 1 y 2 de arriba (Proactividad).
2. Siete personas con protocolo cargado y sin ningún Raven: Habilidad cognitiva
   les sale sin puntaje. ¿Rindieron alguno?
3. Cinco personas con 12 aciertos o menos cargados a mano como Raven de 36, que
   no están en la lista del Raven corto. Si rindieron el corto, hoy figuran con
   rango bajo por error.

### Para nosotros

- **Liderazgo sobrestima.** Promedia 55 contra 47 de ellas, y da Alto en 12 de
  47 donde ellas lo dieron en 2 de 29. La única combinación de pesos que lo
  corrige es sacar GHR : PHR y EB, y con 29 informes el resultado cambia mucho
  con cada peso. Volver a medir con más informes antes de tocarlo.
- **Autogestión en Rorschach quedó como estaba.** Ninguna combinación de pesos
  mejora cuando se la prueba con un informe que no se usó para ajustarla.
- **Unos 20 puntajes a más de 10 puntos sin explicar**, entre Habilidad
  cognitiva y Habilidad interpersonal. Puede ser criterio de entrevista o algún
  error de carga.
- **Seis informes de la carpeta no se pudieron comparar**: cuatro personas
  tienen la recomendación cargada y no el protocolo, y dos no están en la base.
- **Los dos documentos enviados el 9/10** ("Auditoría del sistema" y "Respuesta
  a Lorena") dicen que dos protocolos quedaban sin puntaje por ser Rorschach
  cortos. Eran Zulliger y el sistema siempre los puntuó: el error fue de la
  medición, que tomó el test de la batería en vez del protocolo.

## Cómo volver a medir

Los guiones y los puntajes de ellas están en
`~/Documents/camposhr-privado/velocimetro/`. `medir.mjs` compara el motor del
repositorio contra sus informes; `distancia.mjs` separa las diferencias por
tamaño; `pesos.py` busca pesos y los valida dejando un informe afuera.

Al medir, el test de cada protocolo se toma de `crudo.meta.test` y no de la
batería del pedido.
