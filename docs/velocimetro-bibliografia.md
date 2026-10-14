# Velocímetro: de dónde sale cada corte

Cada indicador del velocímetro lleva su fuente: el autor y la página, o el
criterio de las psicólogas escrito como tal. Lo que está en los libros se
aplica y se avisa; lo que los libros no resuelven se les pregunta. Empezado el
14/10/2026 con el Zulliger; el Rorschach se completa cuando estén las páginas
de Exner y Sendín.

## Zulliger

Fuente: Zdunic, A. L., *El Test de Zulliger en la evaluación de personal*,
adaptación argentina. Capítulo 7, "Sumario estructural" (p. 69 a 96), con los
valores convencionales de cada índice; y Apéndice f, "Estadísticos
descriptivos" (p. 203 a 207), sobre 500 protocolos de selección de personal en
la Ciudad de Buenos Aires, 2010 y 2011. "Esperable" es el valor convencional
del capítulo 7, que coincide con el tramo entre los percentiles 25 y 75 del
apéndice. La tabla del apéndice está transcripta en
`camposhr-privado/velocimetro/zdunic-normas.json`.

| Indicador | Corte del motor | Zdunic | Página |
| --- | --- | --- | --- |
| R | menos de 8 no se puntúa; 9 a 11 medio; 12 o más alto | 9 (9 y 11); con menos de 8 la prueba no es válida | 73 |
| Lambda | esperable de 0,29 a 0,80 | 0,50 (0,29 y 0,80) | 74 |
| EB | peso 0, queda como lectura | "No existen valores que en sí mismos sean mejores o peores, indican un estilo personal" | 74 |
| EA | medio desde 3, alto desde 5,5 | 4 (3 y 5) | 76 |
| EA − es | esperable desde −1,5 | es alta cuando EA − es es menor que −1. **Las psicólogas anotaron "hasta −1,5" al margen y el motor usa eso**: con −1,5 el libro ya habla de es alta | 77 |
| XA% / WDA% | esperable desde 0,78 | mayores que 0,80 (percentil 25 del apéndice: 0,78). **El 0,78 lo fijaron las psicólogas en Configuración** | 78 |
| X−% | esperable hasta 0,25 | menor que 0,25 | 79 |
| P | esperable de 2 a 4 | 3 (2 y 4). Las cinco populares: lámina I W insecto y D1 hoja; II ninguna; III D3 y D2 persona, D1 mariposa. "Es significativa la ausencia de respuestas populares" | 57 y 79 |
| Ma : Mp | esperable salvo Mp mayor que Ma + 1 | "Es desaconsejable que aparezca Mp mayor que Ma + 1" | 81 y 82 |
| Intelectualización | esperable hasta 1 | 0 y 1 | 82 |
| M− | esperable en 0 | "siempre constituyen un indicador preocupante" | 82 |
| FC : CF + C | esperable sin C pura y con CF + C hasta 2 | FC 0 (0 y 1), CF 2 (1 y 2), C 0. "Si CF + C tiene un valor muy superior a FC, controla poco las descargas". **CF + C de 3 como descarga es lectura nuestra de "muy superior"** | 84 |
| C' | esperable hasta 1 | la proporción SumC' : SumPondC, con el lado izquierdo inferior al derecho. **El corte en 1 es del diccionario de las psicólogas** (percentil 75 del apéndice: 1) | 85 |
| Dd | esperable hasta 2 | Dd 1 (0 y 2); "lo que siempre resulta preocupante es cuando se incrementan las Dd" | 87 |
| W : M | esperable de 1,5 a 2,5 | "que W sea el doble de M". **El medio punto de tolerancia es nuestro** | 88 |
| PSV | esperable en 0 | 0 | 88 |
| DQ+ | 2 a 4 esperable; 5 o más alto (como proporción de R: 0,18 y 0,45) | 3 (2 y 5) | 88 |
| Vagas (DQv) | esperable en 0 | v = 0 | 89 |
| COP / AG | 2 o más COP con hasta 1 AG alto; 1 COP medio; sin COP bajo | "Lo habitual es que aparezcan. La ausencia de ambos suele indicar poco interés en las relaciones". **Los escalones son nuestros** | 90 |
| GHR : PHR | GHR mayor que PHR; con menos de 3 entre los dos no se interpreta | GHR > PHR; "no es razonable considerar este índice cuando sumados dan menos de 3" | 90 |
| Fd | esperable en 0 | 0; "suelen darlas personas dependientes"; con T, necesidad de cercanía | 56 y 91 |
| T | esperable en 0 | 0 | 91 |
| Contenidos H | esperable de 2 a 4 | 3 (2 y 4); "si los contenidos H son escasos, probablemente dificultades en las relaciones interpersonales" | 54 y 92 |
| Aislamiento | esperable hasta 0,33 | significativo si está elevado (mayor que 0,33); "un índice bajo no brinda información" | 55 y 92 |
| Egocentrismo | esperable de 0,33 a 0,56 | entre 0,33 y 0,56; el disminuido también importa | 94 |
| m + Y | esperable hasta 2 (suma) | m 0 (0 y 1), Y 1 (0 y 2) en el apéndice; el capítulo lee el eb entero (C' + T + Y + V igual o menor que FM + m). **La suma con corte en 2 es de las psicólogas** | 76 y 205 |

Regla de codificación para el capturador (p. 53), pendiente de aplicar: si una
respuesta incluye Na junto con Bt o Ls se codifica solo Na, y si incluye Bt y
Ls, solo uno de los dos, para no inflar el índice de aislamiento.

Indicadores del libro que el motor no usa: a : p (ninguno triplica al otro),
S (2, de 1 a 3), S−, complejas sobre R (2, de 1 a 3), SumC' : SumPondC, CP,
MOR (0 y 1), Suma bruta 6 (menos de 3), Nivel 2 (0), Suma ponderada 6 (más de
4 es alerta), MQsin, PER (0 y 1), H pura mayor que el resto, Fr + rF, SumV (0),
FD (0 y 1), An + Xy (menos de 2), X+% y Xu% (su suma mayor que 0,80),
contenidos agresivos AgC de Gacono y Meloy (si AgC supera a AG, más
probabilidad de actuar la agresión; p. 57 y 58).

## Rorschach

| Indicador | Corte del motor | Fuente |
| --- | --- | --- |
| W : M | por estilo: introversivo 0,8 a 1,5; ambigual 1,3 a 2; extratensivo 1,3 a 3 | Rorschach Archives of Argentina, material de circulación restringida, Paso 4 "W : M (Proporción de aspiraciones)". Coincide con Exner. Lo mandó Lorena el 14/10/2026 |

Pendiente: las páginas de Exner y Sendín que usan las psicólogas, para citar
el resto de los cortes de la hoja del Rorschach de la misma forma.
