# Velocímetro: lo que se decidió distinto a las psicólogas y lo que falta

## Versión 1.0, congelada el 15/10/2026

Publicada en `0a1cb1d`. Desde acá no se ajustan pesos ni cortes contra los
informes a mano: con 30 a 43 informes por test y decenas de índices probados,
una correlación puede salir por azar.

| Índice | Valor | Cómo se mide |
| --- | --- | --- |
| Confianza metodológica | 100 | Cada corte con fuente citada (`velocimetro-bibliografia.md`) |
| Coincidencia de puntajes | 67 % (263 de 393) | Misma banda que sus informes; 9,4 puntos de diferencia por persona |
| Coincidencia de redacciones | 78 % (821 de 1.054) | Lecturas de sus informes que el sistema propone, por concepto |

**Cómo se cierra:**

1. Los próximos 10 informes los puntúan Lorena y Lucila por separado, antes de
   abrir el velocímetro.
2. Se comparan tres pares: entre ellas y el sistema contra cada una.
3. Si el sistema coincide con cada una tanto como ellas entre sí, no se ajusta
   más. Solo se miran los casos a más de 15 puntos de las dos.
4. A los 90 días de cada ingreso se le pregunta al cliente cómo le fue a quien
   contrató, y se cruza con los puntajes.

**Falta decidir:** dónde anotan el puntaje a ciegas (planilla o campo en el OS)
y cómo se pide el dato de los 90 días (puede ir con el tramo `noventa` de
`lib/plan-incorporacion.ts`). Y si el corte de Fd en Zulliger del 10/9 era a
propósito: desde el 15/10 sale desde 1.

Lo que sigue es la historia hasta la versión 1.0.

## Estado al 14/10/2026

Sale de comparar el motor contra 73 informes que Lucila y
Lorena escribieron a mano, y de sus respuestas del 9/10 y del 13/10.

Los nombres de las personas que se mencionan como pendientes están fuera de
este repositorio, que es público:
`~/Documents/camposhr-privado/velocimetro/pendientes-con-nombres.md`.

## Dónde estamos

| Medida | 8/10/2026 | 14/10/2026 |
| --- | --- | --- |
| Puntajes en la misma banda que sus informes | 48 % | 72 % (280 de 387) |
| Diferencia media con sus puntajes | 11,2 puntos | 3,9 puntos |
| Diferencias de más de 20 puntos | sin medir | 27 de 387 |

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
| 4 | Raven en tres bandas (0 a 20, 21 a 30, 31 a 36), y aparte "considerar puntajes intermedios cerca del 25 y del 30" | De 25 a 30 aciertos sigue en medio y aporta 58: la competencia sale en 64, contra 57 de 21 a 24 aciertos | Con tres bandas, 21 y 30 aciertos recibían lo mismo. El corte en 25 es lectura nuestra de su frase. Con 75 salía en 79 (Alto) donde ellas ponen 60; con 58 queda a 0,3 puntos de ellas en las veinte personas de ese tramo |
| 5 | D y AdjD: mayor que 0 alta, igual a 0 media, menor que 0 baja | Alta con los dos por encima de 0, baja con AdjD negativo, **media en el resto** | No dice qué hacer con AdjD en 0 o más y D negativo. Se dejó en media porque ella definió AdjD como la capacidad habitual |
| 6 | m + Y: "si Y > 1 y m > 2 serán negativo" | En Rorschach, negativo con **cualquiera de las dos** pasada | Se leyó "y" como cada una por su lado. En Zulliger sigue la suma |
| 7 | Su lista pone Zf y Zd en Capacidad intelectual de Rorschach | No vuelven | El 30/9 se sacaron de ahí con ellas para no contarlos dos veces. La lista parece una versión anterior |
| 8 | An+Xy no se informa si la profesión tiene que ver con el cuerpo | No se agregó nada | El sistema no sabe la profesión. La evaluadora borra esa línea en la ficha, que ya se puede |
| 9 | En Rorschach las frases de EA dependen de D y de AdjD | Dependen de AdjD solamente | Un D negativo ya tiene su propia lectura (tensión del momento) |
| 10 | Liderazgo se evalúa en la batería 2, sin análisis discursivo | Ya funcionaba así: se calcula con los seis indicadores restantes | Sin cambio |
| 11 | Los pesos "es más que probable" que difieran de sus informes | Proactividad: R 4, Fd 3, Ma : Mp 2, DQ+ 2, Zf 0, igual en los dos tests. Autogestión en Zulliger: Lambda 3, T 3, W : M 1, Dd 1, EB 1 | En Zulliger W : M da negativo en 39 de 46 personas. Las diferencias de más de 20 puntos bajaron de 18 a 7 en Proactividad y de 10 a 5 en Autogestión |

### Reglas nuevas que ella no pidió

- **La batería decide qué competencias llevan número (14/10/2026).** La
  escala y las preguntas son siempre las mismas; lo que la batería no midió
  sale debajo de los velocímetros como "no incluida en la batería contratada,
  requiere X". Hoy es Habilidad cognitiva sin Raven.
- **Cada competencia tiene un indicador imprescindible** (hoy, el Raven). Sin
  él no hay puntaje y el informe dice cuál falta; sin cualquier otro se calcula
  con los que hay. Reemplaza a "sin más de la mitad del peso".
- **El Raven entra en línea continua por aciertos (14/10/2026).** Anclas en
  8, 20, 27, 30 y 36 aciertos (25, 42, 57, 65, 100), tomadas de lo que ellas
  pusieron a 52 personas. Antes eran cuatro escalones: 5 y 20 aciertos daban lo
  mismo, y de 30 a 31 la competencia saltaba 36 puntos. Habilidad cognitiva
  pasó de 51 a 57 coincidencias de 66, y de 12 a 26 valores distintos.
- **W : M con la banda del estilo**, la misma del diccionario (14/10/2026).
  Exigía exactamente 2; 15 de 44 Rorschach están en banda y 6 en exactamente 2.
- **Sin respuestas humanas o sin color, GHR : PHR y FC : CF + C dan bajo.**
  Se probó dejarlos sin dato y Lorena lo corrigió el mismo día (14/10/2026):
  no registrar lo humano y evitar el color son indicadores en sí.
- **El máximo de cada competencia es fijo** por test y pesos, no por lo que
  cada persona tiene cargado (14/10/2026). Sobre los protocolos cargados no
  cambia ningún número; evita que falte un recurso y se estire el resto.
- **Se probó anclar el 50 y no reescalar, y se descartó** (14/10/2026): la
  coincidencia caía a 67 % y 66 %, y Alto quedaba por debajo del 10 % en
  Autogestión y Control emocional, donde ellas lo dan seguido.
- **Zulliger más alto que Rorschach, revisado.** Ellas mismas puntúan más
  Autogestión a los candidatos de Zulliger (58,7 contra 47,7): es en parte su
  criterio y no solo la cuenta. Lo que queda como sobreestimación es Control
  emocional en Zulliger: 60,6 del sistema contra 54,6 de ellas.
- **La coincidencia con los informes a mano deja de ser la meta (14/10/2026,
  noche).** Para un mismo perfil de indicadores ellas pusieron bandas
  distintas en 28 de 67 grupos, con 4,5 puntos de desvío dentro de la misma
  evaluadora; Lorena y Lucila promedian igual (54,2 y 55,8). El techo de
  coincidencia para cualquier sistema que dé siempre lo mismo al mismo perfil
  es 89 %. Estamos en 73 %. De acá en adelante se mide el sistema: regresión
  antes de publicar, margen por competencia y percentil propio en el informe.
- **EB fuera del promedio (14/10/2026, noche).** Pesa 0 en Autogestión y en
  Liderazgo; sigue en el desglose y como lectura del informe. Exner no
  establece que un estilo sea mejor que otro y no interpreta el estilo con EA
  por debajo de 4. Contado como mérito del introversivo daba bajo a 35 de 47
  Rorschach y a 41 de 46 Zulliger. Mueve 138 puntajes: Autogestión +4 en
  promedio (8 cambian de banda), Liderazgo +2,5 (14 cambian). Con esto
  Autogestión queda 4,5 puntos arriba de ellas y Liderazgo 8,6: lo resuelven
  los cortes (pregunta 1 a Lorena) y recurso o esperable (pregunta 2).
- **Zulliger con las normas de Zdunic (14/10/2026, noche).** Agustín escaneó
  el Apéndice f (500 protocolos de selección, Buenos Aires). Lo esperable es
  el tramo entre los percentiles 25 y 75. Cambiaron cuatro cosas: populares
  de 2 a 4 (ayer se había puesto 3 a 4 con nuestros datos); contenidos humanos
  de 2 a 4 para todos los estilos (se usaba la tabla de Exner, que pedía 4 a 6
  a los introversivos); DQ+ de 2 a 4 esperable y 5 o más alto (con el corte
  del Rorschach la persona mediana salía alta); y FC : CF + C, donde en
  Zulliger lo normal es CF por encima de FC (FC mediana 0, CF 2): la descarga
  es C pura o CF + C de 3 o más, en el velocímetro y en el diccionario. Los
  otros doce cortes ya coincidían. Efecto: Control emocional +7 en 22
  Zulliger, Interpersonal +4,7 en 13, Proactividad −11 en 21. Coincidencia
  71 % (278 de 389), que ya no es la meta.
- **Zulliger con el capítulo 7 de Zdunic (14/10/2026, noche).** Tres cambios
  más, con cita: GHR : PHR no se interpreta con menos de 3 entre los dos
  (p. 90; que falten humanos lo dice Contenidos H), egocentrismo con banda de
  0,33 a 0,56 en los dos sentidos (p. 94), y W : M de 1,5 a 2,5 ("que W sea el
  doble de M", p. 88; el medio punto de tolerancia es nuestro). EB en 0 queda
  citado (p. 74). Diferencias que quedan anotadas: EA − es (el libro dice es
  alta con menos de −1; ellas anotaron hasta −1,5) y XA% (libro 0,80; ellas
  0,78 en Configuración). Efecto: Interpersonal −9 en 35, Autogestión +19 en
  8. Cada corte del Zulliger con su página: `docs/velocimetro-bibliografia.md`.
- **Lo que está en los libros no se pregunta.** Cada corte tiene que tener su
  fuente (autor y página) o el criterio de ellas firmado como tal. Falta armar
  esa bibliografía del motor con los libros que tengan ellas.
- **El potencial de Jaques salió de Liderazgo** (14/10/2026, decisión de
  Agustín; ellas lo habían puesto el 17/9 con peso 3). Mide el alcance y el
  plazo del trabajo que la persona sostiene; Liderazgo pregunta por conducir
  personas, y sus otros seis indicadores hablan de eso. El potencial tiene su
  capítulo propio. Liderazgo se puntúa en toda batería con Rorschach y
  significa lo mismo en la estándar y en la ejecutiva. **Avisarle a Lorena.**

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
- **Habilidad cognitiva e interpersonal, revisadas caso por caso (14/10/2026).**
  En cognitiva, once de los diecinueve desvíos eran el aporte del Raven de 25 a
  30 aciertos, ya corregido (punto 4). Lo que queda es variación de ellas: con
  30 aciertos pusieron 60, 65, 70 y 75. En interpersonal no hay un indicador
  que lo explique: siete Zulliger con el mismo perfil dan 64 en el sistema y
  ellas les pusieron 50, 60 y 70. Mover pesos no mejora la coincidencia.
- **Populares en Zulliger, resuelto el 14/10/2026.** Se medía P con la tabla
  del Rorschach (de 4 a 6 con menos de 17 respuestas), pero el Zulliger tiene
  cinco populares en total según su tabla de calidad formal (lámina I: W
  insecto y D1 hoja; lámina II: ninguna; lámina III: D1 mariposa, D2 y D3
  persona). Salían con P bajo 32 de 46 personas, y el informe les decía que
  "no ven las cosas como la mayoría". Ahora lo esperado en Zulliger es de 3 a
  4, en el velocímetro y en el diccionario (`pEsperado`): sale bajo uno de cada
  tres, como en el Rorschach, y 5 es alto. La coincidencia con ellas no cambia
  (279 de 387); Habilidad interpersonal en Zulliger sube 2 puntos en promedio.
  Hay dos protocolos con 6 populares, que en Zulliger no puede pasar: es un
  error de carga a revisar.
- **Seis informes de la carpeta no se pudieron comparar**: cuatro personas
  tienen la recomendación cargada y no el protocolo, y dos no están en la base.
- **Control emocional en Zulliger** sobreestima 6 puntos. Candidato a revisar:
  FC : CF + C y EA − es, que son 5 de 13 del peso.
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
