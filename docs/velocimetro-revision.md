# El velocímetro de competencias, medido

17/9/2026. Versión en línea, para leer y comentar:
https://claude.ai/code/artifact/1d27bfa8-9f09-4521-b41c-e8b2dabd9417

## En una pantalla

Corrí el motor que calcula los velocímetros, el mismo que usa el informe, sobre
**los 73 protocolos con sumario que hay en la base**: 40 Rorschach y 33
Zulliger. De esos, 59 puntúan. A los otros 14 los frena el propio sistema, y hace
bien en frenarlos.

Tres cosas mandan sobre todo lo demás:

1. **El puntaje sube cuando no aparece nada malo.** La mitad de los indicadores
   son señales de alarma, y estar dentro de lo normal les vale 100 puntos, igual
   que un recurso alto. Por eso Capacidad intelectual en Zulliger tiene 17 de 27
   candidatos en Sobresaliente.
2. **Los indicadores de una misma competencia no se mueven juntos.** En varias,
   quien sale bien en uno tiende a salir mal en los otros. Promediarlos borra
   información en lugar de sumarla.
3. **El Raven pesa 1 sobre 6** y es el único instrumento con norma poblacional.
   Además no tiene relación con los cinco índices del protocolo que lo acompañan
   en esa competencia.

Se puede volver a correr cuando haya más casos: `node scripts/auditar-velocimetro.mjs`
para los hallazgos 1 a 10, y `node scripts/validar-velocimetro.mjs` para los dos
controles de los hallazgos 11 y 12.

## Las tres medidas que vas a ver, en castellano

Hay tres números que se repiten en todo el documento. Son estándar en
psicometría y cada uno contesta una pregunta simple.

| El número | Qué pregunta contesta | Cómo se lee |
| --- | --- | --- |
| **Acuerdo entre indicadores** (alfa de Cronbach) | Los seis indicadores de una competencia, ¿miden lo mismo? | Va de 0 a 1. Cerca de 1, los indicadores se mueven juntos y el promedio significa algo. Cerca de 0, cada uno va por su lado. En negativo, se contradicen entre sí. Para decidir sobre una persona se pide 0,80 |
| **Cuánto acompaña un indicador** (correlación ítem-resto) | Ese indicador, ¿va para el mismo lado que sus compañeros? | Va de −1 a 1. Positivo alto: aporta lo mismo que el resto. Cerca de 0: aporta algo propio. Negativo: cuando el resto dice bien, él dice mal |
| **Cuánto se parecen dos competencias** (correlación) | Autogestión y Liderazgo, ¿son dos lecturas o una repetida? | 0 es sin relación, 1 es la misma medida con otro nombre. Arriba de 0,70 las dos agujas dicen casi lo mismo |

Un cuarto dato aparece seguido: **en qué porcentaje de los protocolos un
indicador sale igual**. Si un indicador da alto en el 96 % de la gente, no separa
a nadie de nadie: le suma lo mismo a todos.

## Lo que ya funciona y conviene no tocar

- **El protocolo que no alcanza no puntúa.** El sistema corta en 14 respuestas
  para Rorschach y 6 para Zulliger (`lib/competencias.ts:1199`), y frena también
  cuando Lambda pasa de 0,99 (`lib/competencias.ts:1220`). De los 73 protocolos,
  2 son cortos y 12 son evitativos: **el 19 % no puntúa, y sin ese freno habría
  puntuado**. En un protocolo evitativo los indicadores de emoción y de vínculo
  salen vacíos porque la persona no los muestra, y el promedio los leería como
  ausencia del rasgo.
- **Un indicador sin dato sale del promedio**, y con dos o más la competencia
  queda sin puntaje.
- **Los cortes y los pesos son datos editables**, así que la cuenta del informe y
  la frase que lee la psicóloga salen del mismo lugar.

## 1. Los indicadores de una competencia no se mueven juntos

Acuerdo entre los indicadores de cada competencia, de 0 a 1:

| Competencia | Rorschach (32 casos) | Zulliger (27 casos) |
| --- | --- | --- |
| Autogestión | **−0,08** | 0,25 |
| Control emocional | 0,54 | **0,07** |
| Habilidad interpersonal | 0,24 | 0,42 |
| Proactividad | **−0,89** | 0,38 |
| Capacidad intelectual | 0,27 | 0,27 |
| Liderazgo | no se puede calcular, 4 casos completos | no existe |

Para decidir sobre una persona se pide 0,80. Ninguna llega. **En negativo, los
indicadores se contradicen**: en Proactividad del Rorschach, quien sale bien en
uno tiende a salir mal en los otros dos, así que el promedio borra la información
en lugar de acumularla.

Hay una lectura alternativa honesta. Si una competencia se piensa como una suma
de partes distintas que no tienen por qué parecerse, este número no aplica. Pero
entonces caen dos cosas que el informe hace hoy: el puntaje deja de poder
presentarse como la medida de una capacidad, y los pesos pasan a ser lo único que
define qué está pesando ese número.

**Qué hacer.** Decidir cuál de las dos cosas es cada competencia. Si mide un
rasgo, hay que sacar los indicadores que no acompañan al resto (hallazgo 4) y
volver a medir. Si es una suma de partes, el informe tiene que decir que el
puntaje resume criterios y no mide un nivel de la persona.

> **Para las psicólogas:** Proactividad del Rorschach tiene tres indicadores que
> se contradicen entre sí. ¿Se rehace la competencia con otros indicadores, o se
> informa sin aguja, solo con el análisis cualitativo?

## 2. No tener nada malo puntúa igual que tener algo bueno

Es el problema de fondo y el único que no se arregla moviendo pesos.

En Control emocional del Rorschach, cinco de los siete indicadores son señales de
alarma: intelectualización, C', vagas, m + Y, y el reverso de FC : CF + C. Un
indicador de alarma que está dentro de rango aporta 100 puntos
(`lib/competencias.ts:54`), exactamente lo mismo que EA alta, que sí es un
recurso. El índice de intelectualización está dentro de rango en el 97 % de los
protocolos, así que aporta 100 en 31 de 32 casos.

Medido: **Capacidad intelectual del Zulliger tiene 17 de 27 protocolos en
Sobresaliente** y una media de 82,6, sobre tres indicadores de alarma (XA%, X−%,
PSV) que están dentro de rango en el 89 %, el 96 % y el 89 % de los casos. El
informe llama Sobresaliente a un protocolo donde no apareció nada.

**Qué hacer.** Separar los indicadores en dos clases con techos distintos:

| Clase | Dentro de rango | Fuera de rango |
| --- | --- | --- |
| Alarma (intelectualización, C', vagas, m + Y, PSV, M−, aislamiento, egocentrismo, CDI, Fd) | 50 | 0 |
| Capacidad (EA, D / AdjD, Contenidos H, GHR : PHR, P, Zf, R, Raven) | hasta 100 | 0 |

Así una competencia solo pasa de 50 cuando aparece algo a favor, y el techo lo
pone lo que la persona tiene.

## 3. Dieciséis indicadores salen igual en casi todos los protocolos

Son los que caen del mismo lado en el 85 % de los casos o más:

| Indicador | Test | Sale igual en | Siempre da |
| --- | --- | --- | --- |
| Índice de intelectualización | Rorschach | 97 % | alto |
| m + Y | Zulliger | 96 % | alto |
| Ma : Mp | Zulliger | 96 % | alto |
| X−% | Zulliger | 96 % | alto |
| M− | Rorschach | 94 % | alto |
| C' | Zulliger | 93 % | alto |
| W : M | Zulliger | 89 % | bajo |
| Índice de aislamiento | Zulliger | 89 % | alto |
| XA% / WDA% | Zulliger | 89 % | alto |
| PSV | Zulliger | 89 % | alto |
| W : M | Rorschach | 88 % | bajo |
| X−% | Rorschach | 88 % | alto |
| PSV | Rorschach | 88 % | alto |
| EB | Zulliger | 85 % | bajo |
| GHR : PHR | Zulliger | 85 % | alto |
| M− | Zulliger | 85 % | alto |

Un indicador que sale igual en el 96 % de los casos no separa a nadie: le suma lo
mismo a todos y no dice nada sobre la persona que se está evaluando.

**Qué hacer.** Distinguir dos causas. Los que quedan constantes por su naturaleza
(PSV, M− y Fd valen 0 en casi todos los protocolos) pesan poco y se leen como
alarma. Los que quedan constantes **porque el corte está mal puesto** necesitan
recalibrarse contra estos 59 casos, igual que ya se hace con el baremo propio del
Raven: contar la distribución real antes de decidir dónde corta.

> **Para las psicólogas:** los cortes de X−%, índice de aislamiento,
> intelectualización y C' dejan al 90 % de la gente del mismo lado. ¿Se
> recalibran contra estos 59 casos, o se sostienen los de las normas publicadas
> porque así tiene que ser en población laboral?

## 4. Ocho indicadores empujan en contra de su propia competencia

Cuánto acompaña cada indicador al resto de los suyos. En negativo, cuando los
otros dicen bien, él dice mal:

| Indicador | Competencia | Test | Cuánto acompaña |
| --- | --- | --- | --- |
| Fd | Proactividad | Rorschach | −0,39 |
| Índice de egocentrismo | Habilidad interpersonal | Rorschach | −0,31 |
| EB | Autogestión | Rorschach | −0,28 |
| Ma : Mp | Proactividad | Rorschach | −0,27 |
| M− | Habilidad interpersonal | Rorschach | −0,22 |
| R | Proactividad | Rorschach | −0,20 |
| Dd | Autogestión | Rorschach | −0,14 |
| m + Y | Control emocional | Zulliger | −0,13 |

Los tres indicadores de Proactividad del Rorschach se contradicen entre sí, y eso
explica el −0,89 del hallazgo 1.

**Qué hacer.** Peso 1 o peso 0 hasta que haya más casos. Peso 0 los deja a la
vista en el detalle del informe y fuera del promedio, que es lo que corresponde a
un indicador que hoy resta.

## 5. W : M exige una igualdad exacta que casi nadie cumple

El indicador da positivo solo si W dividido M es exactamente 2,00
(`lib/competencias.ts:386`). Sobre los 73 protocolos:

| Cómo dio W ÷ M | Protocolos |
| --- | --- |
| Exactamente 2,00 | 10 |
| Entre 1,50 y 2,50, sin llegar a 2,00 exacto | 10 |
| Fuera de ese rango | 47 |
| Sin M, no se puede calcular | 6 |

El indicador sale bajo en el 88 % de los Rorschach y en el 89 % de los Zulliger.
Con W 8 y M 4 es positivo; con M 5 es negativo y la competencia pierde 17 puntos,
sin que exista una diferencia clínica que justifique ese salto.

**Qué hacer.** Convertirlo en banda de 1,50 a 2,50, que es como se lee la razón
en la literatura del Sistema Comprehensivo. Con ese cambio pasan a positivo 20
protocolos de 67 en lugar de 10, y el indicador empieza a separar gente.

## 6. El Raven no se mueve junto con los índices que lo acompañan

Medido sobre los 47 protocolos que tienen Raven cargado:

| Qué se comparó | Cuánto se parecen |
| --- | --- |
| El Raven con el puntaje entero de Capacidad intelectual | 0,33 |
| El Raven con los otros índices de esa competencia, sin contarlo a él | **0,01** |

Los cinco índices del protocolo que hoy comparten competencia con el Raven
(XA%/WDA%, X−%, Zf, Zd, PSV) no tienen ninguna relación con él. O ellos no están
midiendo capacidad intelectual, o el Raven no: el Raven es el único de los dos
que tiene norma poblacional y un rango de 36 puntos.

Y así y todo pesa 1 sobre 6, y entra achatado a tres bandas
(`lib/competencias.ts:519`) cuando podría entrar con su percentil.

Efecto medido: Capacidad intelectual del Rorschach no tiene **ningún** protocolo
en Bajo sobre 32, y la del Zulliger tiene 1 sobre 27.

**Qué hacer.** Dos cosas. El Raven pasa a 6 de 9 del peso de la competencia, que
es el 67 %, y se convierte a valor continuo desde el percentil en lugar de tres
bandas. Con ese peso aplicado sobre los mismos protocolos, Capacidad intelectual
del Rorschach pasa de 0 a 8 protocolos en Bajo, y la del Zulliger de 1 a 8, con
los Sobresalientes bajando de 17 a 11.

## 7. Seis competencias informan menos de seis cosas

Cuánto se parecen entre sí los puntajes de las competencias:

| Par | Test | Cuánto se parecen |
| --- | --- | --- |
| Liderazgo con Habilidad interpersonal | Rorschach | **0,73** |
| Control emocional con Habilidad interpersonal | Zulliger | **0,70** |
| Autogestión con Control emocional | Rorschach | 0,48 |
| Habilidad interpersonal con Capacidad intelectual | Zulliger | 0,43 |

Liderazgo comparte tres indicadores con Habilidad interpersonal (GHR : PHR,
Contenidos H y Afr), así que ese 0,73 está puesto por cómo se armó la competencia
y no por la persona. El cliente lee seis agujas creyendo que son seis lecturas
independientes.

**Qué hacer.** Un indicador entra en una sola competencia. Zd queda en
Autogestión y sale de Capacidad intelectual; Contenidos H y Afr quedan en
Habilidad interpersonal y salen de Liderazgo. Lo que quede de Liderazgo tiene que
apoyarse en lo suyo, que es el potencial del análisis discursivo.

## 8. La aguja tiene cinco escalones donde el informe promete cien

Valores distintos que tomó cada competencia sobre todos los protocolos medidos:

| Competencia | Rorschach | Zulliger |
| --- | --- | --- |
| Autogestión | 5 | 5 |
| Proactividad | 5 | 6 |
| Capacidad intelectual | 9 | 7 |
| Habilidad interpersonal | 11 | 9 |
| Control emocional | 11 | 9 |

Con seis indicadores de peso 1, la competencia solo puede dar 0, 17, 33, 50, 67,
83 o 100, y cada indicador mueve 17 puntos. En Proactividad, que tiene tres, cada
uno mueve 33. Como el informe corta las bandas en 35, 65 y 80, **un solo
indicador cambia la banda que lee el cliente**, y varios de esos indicadores se
deciden por una respuesta de diferencia en el protocolo.

**Qué hacer.** Pesos desparejos, que es lo que propone la tabla más abajo: con
pesos 3, 3, 2, 2, 1, 1 los valores posibles pasan de 7 a 25, y el indicador flojo
deja de mover una banda entera. Y en el informe, decir primero la banda y después
el número: el número promete una precisión que estos datos no tienen.

## 9. Los cortes no distinguen un Rorschach de un Zulliger

El mismo indicador se comporta de manera muy distinta según el test:

| Indicador | Da alto en Rorschach | Da alto en Zulliger |
| --- | --- | --- |
| Dd | 31 % | 78 % |
| Lambda | 72 % | 56 % |
| m + Y | 44 % | 96 % |
| Índice de aislamiento | 78 % | 89 % |

La causa es la cantidad de respuestas: **el Rorschach tiene una mediana de 21
respuestas, de 9 a 39, y el Zulliger de 10, de 8 a 13**. Todo índice que sea una
proporción sobre R, o una cuenta de apariciones, cambia de escala entre un test y
el otro.

**Qué hacer.** Cada corte del Zulliger se define contra las normas del Zulliger y
contra la distribución de estos 27 casos, sin copiar el del Rorschach. Mientras
no estén calibrados, los indicadores de cuenta simple del Zulliger (m + Y, C',
PSV, M−) tienen que pesar menos que los de proporción.

## 10. El único indicador propio de Liderazgo falta en 28 de 32 protocolos

El potencial del análisis discursivo (`lib/competencias.ts:609`) está cargado en
4 de los 32 Rorschach medidos. Es el único indicador de Liderazgo que no viene
prestado de otra competencia, y falta en el 88 % de los casos.

Como falta uno solo, la regla de "dos o más sin dato" no se activa y la
competencia sale con puntaje igual: **el Liderazgo que hoy se informa está armado
casi por completo con indicadores de Habilidad interpersonal y de Autogestión**.
De ahí viene el 0,73 del hallazgo 7.

**Qué hacer.** Mientras el análisis discursivo no se cargue siempre, Liderazgo
sale del informe o sale sin aguja, con el análisis cualitativo solamente. Si se
carga, pasa a ser el indicador de mayor peso de esa competencia.

> **Para las psicólogas:** ¿Liderazgo se sostiene sin el análisis discursivo? Y
> si la respuesta es que no, ¿se empieza a cargar en todos los protocolos de
> batería 3 o se saca la competencia del informe?

## 11. Una sola respuesta cambia la banda que lee el cliente

Se sacó una respuesta de cada protocolo, de a una por turno, se recalculó el
sumario entero y se volvieron a puntuar las competencias. Son 46 protocolos y
813 recalculados completos.

| | Rorschach | Zulliger |
| --- | --- | --- |
| Protocolos probados | 27 | 19 |
| La banda informada cambia | **19,2 %** de las veces | **36,5 %** de las veces |
| El puntaje se corre, en promedio | 5,2 puntos | 10,5 puntos |
| Se corre 10 puntos o más | 27 % de las veces | 47 % de las veces |
| La competencia se queda sin puntaje | 7,8 % | 10,9 % |

En Zulliger, más de un tercio de las bandas que se informan dependen de una sola
respuesta del protocolo. La causa es la del hallazgo 9: con una mediana de 10
respuestas, sacar una mueve todas las proporciones a la vez.

Dónde se concentran los cambios de banda, sobre 1.061 casos: Capacidad
intelectual 492, Proactividad 208, Autogestión 117, Liderazgo 93, Habilidad
interpersonal 91, Control emocional 60.

**Qué hacer.** Tres cosas, en orden. Informar la banda y no el número, porque el
número promete una precisión de un punto que no existe. Aplicar los pesos
desparejos del hallazgo 8, que es lo que baja la cantidad de bandas que dependen
de un indicador solo. Y en Zulliger, no informar aguja en Proactividad ni en
Capacidad intelectual, que son las dos que más se mueven.

## 12. El velocímetro coincide con el juicio de la psicóloga, en los pocos casos que se pueden comparar

Es el único criterio externo disponible hasta que haya seguimiento a 90 días:
comparar el puntaje contra el nivel de ajuste que firmó quien evaluó.

| Lo que dijo la psicóloga | Casos | Promedio de las competencias |
| --- | --- | --- |
| Encaja con el puesto | 3 | 74,8 |
| Encaja, con reparos | 6 | 59,0 |
| No encaja, o encaja en otro puesto | 4 | 49,0 |

**El orden se respeta y no hay ninguna contradicción**: ningún caso donde ella
dijo que no encaja y el sistema dio Alto o Sobresaliente, ni al revés. Con 13
casos esto no prueba nada por sí solo, pero es la primera evidencia de que el
puntaje apunta a donde apunta el criterio clínico.

**El problema es la muestra, y es un problema de carga**: de 81 evaluaciones con
sumario, **64 no tienen la recomendación cargada**. El campo existe en la ficha y
se completa en dos clics. Tampoco está cargado en Airtable, así que no hay un
lote histórico para recuperar.

**Qué hacer.** Que la recomendación se cargue en todas las evaluaciones, incluidas
las que ya se entregaron y se puedan reconstruir del informe. Es lo más barato que
se puede hacer hoy para validar el sistema, y cada informe que sale sin ese dato
es un caso que se pierde para siempre.

## Los pesos que propongo

Tres criterios juntos para cada peso: qué apoyo tiene el índice en la literatura,
cuánto acompaña al resto de su competencia según lo medido acá, y qué tan estable
es en un protocolo corto. La escala del sistema va de 0 a 10
(`lib/escalas.ts:22`); peso 0 deja el indicador a la vista en el detalle y fuera
del promedio.

### Rorschach

| Competencia | Indicador | Peso | Aporte | Por qué |
| --- | --- | --- | --- | --- |
| Autogestión | Lambda | 3 | 25 % | estilo de afrontamiento, apoyo sólido |
| | Zd | 3 | 25 % | esfuerzo de organización, propio de esta competencia |
| | W : M | 2 | 17 % | con la banda 1,50 a 2,50 del hallazgo 5 |
| | Dd | 2 | 17 % | priorización, proporción estable |
| | EB | 1 | 8 % | apoyo débil y acompaña −0,28 |
| | T | 1 | 8 % | vale 0 o 1 en casi todos los protocolos |
| Control emocional | EA | 3 | 23 % | el recurso disponible, con tres bandas reales |
| | D / AdjD | 3 | 23 % | acompaña 0,56, la mejor de la competencia |
| | m + Y | 2 | 15 % | acompaña 0,57 |
| | FC : CF + C | 2 | 15 % | regulación, apoyo moderado |
| | C' | 1 | 8 % | alarma, acompaña 0,41 |
| | Índice de intelectualización | 1 | 8 % | constante en el 97 % |
| | Vagas | 1 | 8 % | alarma de baja frecuencia |
| Habilidad interpersonal | GHR : PHR | 3 | 19 % | calidad del vínculo, el mejor apoyado del bloque |
| | Contenidos H | 3 | 19 % | interés por los otros, con rango esperado según R |
| | CDI | 2 | 13 % | acompaña 0,40, constelación validada |
| | P | 2 | 13 % | ajuste a lo convencional |
| | COP / AG | 1 | 6 % | apoyo débil |
| | Índice de aislamiento | 1 | 6 % | apoyo débil |
| | Afr | 1 | 6 % | apoyo débil |
| | M− | 1 | 6 % | constante en el 94 %, acompaña −0,22 |
| | Índice de egocentrismo | 0 | 0 % | acompaña −0,31 y apoyo débil |
| Proactividad | Ma : Mp | 2 | 40 % | iniciativa frente a pasividad |
| | R | 2 | 40 % | productividad, con la salvedad del hallazgo 9 |
| | Fd | 1 | 20 % | acompaña −0,39, queda hasta rehacer la competencia |
| Capacidad intelectual | Raven | 6 | 67 % | único con norma, percentil y 36 puntos de rango |
| | XA% / WDA% | 2 | 22 % | ajuste perceptivo, apoyo sólido |
| | X−% | 1 | 11 % | constante en el 88 % y se superpone con el anterior |
| | Zf | 0 | 0 % | lo cubre Zd en Autogestión |
| | Zd | 0 | 0 % | doble conteo, hallazgo 7 |
| | PSV | 0 | 0 % | constante en el 88 % |
| Liderazgo | Potencial | 3 | 43 % | lo único propio de esta competencia |
| | W | 2 | 29 % | visión global, que es lo que la competencia define |
| | GHR : PHR | 1 | 14 % | repetido con Habilidad interpersonal |
| | H : (H) + Hd + (Hd) | 1 | 14 % | interés por las personas |
| | EB | 0 | 0 % | repetido y con apoyo débil |
| | Contenidos H | 0 | 0 % | repetido, hallazgo 7 |
| | Afr | 0 | 0 % | repetido y con apoyo débil |

### Zulliger

Con una mediana de 10 respuestas, todo indicador de cuenta simple es más
inestable que en un Rorschach, así que el peso se concentra en menos indicadores.

| Competencia | Indicador | Peso | Aporte |
| --- | --- | --- | --- |
| Autogestión | Lambda | 3 | 33 % |
| | W : M | 2 | 22 % |
| | Dd | 2 | 22 % |
| | T | 1 | 11 % |
| | EB | 1 | 11 % |
| Control emocional | EA | 3 | 25 % |
| | EA − es | 3 | 25 % |
| | FC : CF + C | 2 | 17 % |
| | Vagas | 2 | 17 % |
| | Índice de intelectualización | 1 | 8 % |
| | C' | 1 | 8 % |
| | m + Y | 0 | 0 % |
| Habilidad interpersonal | GHR : PHR | 3 | 25 % |
| | Contenidos H | 3 | 25 % |
| | COP / AG | 2 | 17 % |
| | P | 2 | 17 % |
| | Índice de aislamiento | 1 | 8 % |
| | M− | 1 | 8 % |
| | Índice de egocentrismo | 0 | 0 % |
| Proactividad | Fd | 2 | 40 % |
| | R | 2 | 40 % |
| | Ma : Mp | 1 | 20 % |
| Capacidad intelectual | Raven | 6 | 67 % |
| | XA% / WDA% | 2 | 22 % |
| | X−% | 1 | 11 % |
| | PSV | 0 | 0 % |

## Qué cambia con esos pesos

Aplicados sobre los mismos 59 protocolos, sin tocar ningún corte:

| Competencia | Test | Hoy | Con los pesos propuestos |
| --- | --- | --- | --- |
| Capacidad intelectual | Rorschach | media 70,3 y 0 protocolos en Bajo | media 58,0 y 8 en Bajo |
| Capacidad intelectual | Zulliger | media 82,6 y 17 Sobresalientes | media 67,5 y 11 Sobresalientes |
| Control emocional | Rorschach | media 59,7 | media 50,6 |
| Autogestión | Rorschach | media 37,0 | media 42,5 |
| Liderazgo | Rorschach | media 45,5 | media 53,3 |

La dirección es la esperable: baja lo que estaba inflado por indicadores que
premian la ausencia de hallazgos, y sube lo que estaba castigado por W : M.

## Lo que dice la literatura

Tres cosas que conviene tener escritas antes de defender un puntaje frente a un
cliente.

**Mihura, Meyer, Dumitrascu y Bombel (2013,** *Psychological Bulletin* **139(3),
548-605).** Meta análisis de las variables del Sistema Comprehensivo contra
criterios externos, clasificadas por nivel de apoyo. El apoyo es sólido en las
variables perceptivo cognitivas: X−%, XA% y WDA%, M−, R, los índices de
procesamiento y las constelaciones de pensamiento. Es débil o nulo en buena parte
de las interpersonales y afectivas, entre ellas COP, AG, Afr, índice de
aislamiento, T, índice de egocentrismo y Fd.

**Sackett, Zhang, Berry y Lievens (2022,** *Journal of Applied Psychology* **).**
Recalcularon la validez de los predictores clásicos de selección corrigiendo el
sesgo de las estimaciones anteriores. La capacidad cognitiva general, la
entrevista estructurada y las muestras de trabajo quedan entre los predictores
más fuertes del desempeño laboral.

**Sobre el Rorschach en selección**, la crítica publicada apunta a la falta de
evidencia de que agregue capacidad predictiva por encima de instrumentos más
simples. La respuesta posible es la que este sistema ya empezó a dar: dejar por
escrito de dónde sale cada afirmación y no presentar el puntaje como una medida
normativa.

Esos dos primeros puntos son los que ordenan los pesos de arriba: adelante lo que
tiene apoyo empírico y relación directa con la competencia, atrás lo de baja
frecuencia y evidencia débil, y el Raven con el peso mayor en Capacidad
intelectual.

## Los límites de esta medición, y el próximo paso

Cuatro límites, y conviene decirlos antes de que los diga otro.

1. **Son pocos casos.** 32 Rorschach y 27 Zulliger. Con ese número, un acuerdo
   entre indicadores calculado acá tiene un margen ancho, y un parecido de 0,30
   no se distingue con seguridad de cero.
2. **No hay criterio externo.** Nada de esto dice si el puntaje predice el
   desempeño de la persona en el puesto, que es la única validez que le importa
   al cliente.
3. **Casi todos los indicadores tienen dos valores**, y la medida de acuerdo se
   comporta peor con indicadores de dos valores que con escalas continuas: los
   números reales podrían ser algo mejores que los calculados.
4. **La muestra no es una población.** Son los candidatos de las búsquedas que
   pasaron por el estudio, ya filtrados por el cliente antes de llegar. Un corte
   recalibrado contra esta distribución vale para esta población, y hay que
   decirlo.

**El próximo paso es el punto 2**, y es más importante que los pesos: cruzar el
puntaje de cada competencia con lo que contestó la empresa a los 90 días. El OS
ya guarda ese seguimiento. Es el único dato que puede convertir esto en una
herramienta de selección validada, y el único que permite contestar con números
la pregunta del cliente: si el informe acierta.
