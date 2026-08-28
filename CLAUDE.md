# Reglas de este repositorio

## Airtable no se toca

**El OS no escribe en Airtable. Nunca. Ninguna pantalla, ninguna ruta de API,
ninguna automatización que salga de este repositorio.**

Airtable se lee, y se lee solo para lo que todavía no fue migrado. Todo lo que
el OS guarda va a Supabase.

El objetivo es migrar Airtable a Supabase y apagarlo. Cada escritura nueva que
se agregue del lado de Airtable es trabajo que después hay que deshacer, y
mientras tanto deja el dato verdadero repartido en dos lugares que se
contradicen.

**Cómo se prueba mientras dura la migración.** Con Distribuidora Andina y
candidatos falsos, todos cargados en Supabase. Es la empresa inventada para eso
(`lib/psicotecnicos-airtable.ts`, `EMPRESA_PRUEBA`). Si una pantalla nueva
necesita datos para probarse, se cargan ahí, no se toma una ficha real de
Airtable.

**Qué hacer cuando una pantalla necesita guardar algo que hoy vive en
Airtable.** Se migra esa entidad a Supabase primero y después se construye la
pantalla. No se guarda en Airtable "por ahora".

## Las columnas de Supabase se llaman como los campos de Airtable

Mientras dure la migración, dos vocabularios para la misma cosa obligan a
traducir en cada consulta. Airtable es la referencia porque es donde está hoy
el trabajo real.

Ya renombradas (2026-08-19, `supabase/renombrar-campos-como-airtable.sql`):

    etapa                -> estado                          ("Estado")
    contacto             -> mensaje                         ("Mensaje")
    grafico_administrado -> grafico_2_personas_administrado  ("Gráfico 2 personas administrado")

El nombre interno de la aplicación no cambió: en el código la propiedad se
sigue llamando `etapa` y el mapa `COLUMNA` de `lib/psicotecnicos-supabase.ts`
la traduce a la columna `estado`. La traducción vive en ese solo lugar.

## Los cambios de esquema van en un archivo, no pegados a mano

    bash scripts/supabase-sql.sh supabase/<archivo>.sql

Corre el SQL contra la base por la API de gestión. El proyecto sale de
`SUPABASE_URL` en `.env.local` y el token de `~/.supabase-pat`, ninguno
versionado. Los DDL viven en `supabase/`, así queda en el historial de git qué
se corrió y cuándo.

## Los desplegables de codificación se generan, no se escriben

`lib/rorschach.ts` (opciones y colores de Lámina, Loc.+DQ, Determinantes, FQ,
Contenidos y CC.EE) está generado desde el esquema de la tabla "Tests
Proyectivos" de Airtable (`tblhq78e1RSmvztC5`). Si allá cambia una opción, se
vuelve a generar; no se edita a mano. Leer ese esquema necesita el permiso
`schema.bases:read`, que hoy tiene `AIRTABLE_TOKEN_ESCRITURA` y no
`AIRTABLE_TOKEN`.

## Las tablas tienen anchos fijos, por campo

`ANCHO` en `app/os/psicotecnicos/piezas.tsx` declara cuánto mide cada columna
por el **nombre del campo**, no por su posición: así "Candidato" mide lo mismo
en cualquier tabla y pasar de una pantalla a otra no mueve nada de lugar.

Quedan tres tablas: Entregados y las dos de Facturación. Todas declaran sus
anchos con `columnas()` y los pasan al `colgroup`.

**El ancho de referencia vale mientras el campo muestre lo mismo.** Cuando no,
forzarlo rompe a las dos tablas a la vez: el puesto se recorta en Entregados,
que lo lleva al lado de la empresa, y va entero en Facturación, donde el panel
es de un solo cliente. Esas diferencias se declaran donde se usan, en el
segundo argumento de `columnas()`, medidas y con el porqué escrito.

**Con anchos declarados, el mínimo de la primera columna no aplica.**
`.os-tabla-trabajo` le da 190 px de mínimo para que el nombre entre entero;
cuando la primera columna es una fecha, ese mínimo la infla y le saca ancho a
las demás. Lo anula `.os-tabla-fija th:first-child`.

Dos reglas al tocarlo:

- **La tabla ocupa el panel y cada columna se lleva su parte.** Los anchos
  viajan al `colgroup` en porcentajes: en píxeles, o sobraba un tercio del
  panel en blanco a la derecha, o faltaba y aparecía **desplazamiento
  horizontal**, que esconde columnas enteras sin avisar.
- **El rótulo de una columna de números va del mismo lado que los números.**
  Alineado a la izquierda, con la columna ancha el rótulo y sus valores quedan
  en puntas opuestas y no se lee cuál encabeza cuál. Se marca el `th` con
  `os-tabla-num`, que hay que nombrar con la tabla delante porque `.os-tabla th`
  alinea a la izquierda y pesa más que una clase sola.
- **Una fila es un renglón.** Lo que no entra se recorta con puntos
  suspensivos. El pedido es la única excepción, con dos: empresa arriba, puesto
  abajo.
- **Cada ancho está medido, no estimado.** Los valores salen de lo que pide el
  contenido más largo de esa columna más los 28 px de padding de la celda. Con
  124 px, el botón "Sin contactar" perdía su padding derecho y el texto quedaba
  contra el borde: se veía como si estuviera descentrado. Antes de mover un
  ancho conviene medir en pantalla qué pide cada columna, que es una línea de
  consola, en vez de calcularlo de memoria.

Tres cosas pelean contra esto y ya están resueltas en `os.css`: el `width: 1%`
de `.os-tabla-trabajo`, que pisaba el `colgroup`; el ancho de la tabla, que si
es `auto` toma el del contenido y reparte el sobrante; y el ancho mínimo propio
de los campos de fecha y los selectores.

**El sobrante se reparte en proporción a lo que pide cada columna, no en
partes iguales.** En partes iguales, cada una terminaba con la mitad de su
ancho en blanco: la fecha de entrevista medía 236 px para mostrar "28/8/26"
mientras el puesto se recortaba. Dárselo entero a una tampoco sirve: en la
columna del importe el rótulo quedaba pegado a la etapa y el número contra el
borde derecho, con la fila partida en dos, y en una columna vacía al final
dejaba un tercio del panel en blanco. En proporción, la que pide más crece más
y todas quedan con el mismo aire relativo.

**En el teléfono la tabla se desarma en fichas.** Abajo de 760 px cada fila
pasa a ser un bloque de "campo: valor", y el nombre del campo sale del atributo
`data-campo` de cada celda: una celda sin ese atributo queda sin rótulo. El
ancho de la tabla y la cantidad de columnas del tablero viajan como variables
(`--os-tabla-ancho`, `--os-columnas`) y no como estilo en línea, porque un
estilo en línea le gana a la consulta de medios y deja la pantalla ancha
adentro del teléfono.

## El test de Raven: la clave no llega al navegador

`lib/raven-test.ts` lleva `server-only` y ahí vive `CLAVE`, las 36 respuestas
correctas. El candidato abre `/raven/<token>` en su casa, así que todo lo que se
mande al navegador lo puede leer: la corrección corre en el servidor y la
pantalla del test nunca recibe la clave ni el puntaje. Lo que se puede importar
desde el componente es `lib/raven.ts`, que solo tiene el baremo y las
constantes.

El reloj también es del servidor. `iniciado_at` se sella cuando se pide la
primera lámina y `segundosRestantes()` mide contra eso: si el tiempo lo llevara
el navegador, recargar la página lo reiniciaría.

## Un solo desplegable para todo el OS

`app/os/Desplegable.tsx`. El del navegador no deja pintar sus opciones, y en
este sistema media docena de cosas se reconocen por su punto de color: la etapa
de una evaluación, el estado de una cotización, la conclusión de un informe. Con
un `select` había que elegir entre el color y poder cambiarlo.

**Cuál va en cada lado.** El componente para lo que se elige y actúa en el acto
(la etapa, el estado, un filtro). El `select` del navegador sigue para lo que
viaja dentro de un formulario, porque el componente no manda un valor con el
`submit`; esos llevan `os-campo` y se ven igual, con la misma flecha y el mismo
alto.

**Su lista se dibuja colgada de `.os`, no donde está el botón.** Adentro la
recortaban tres cajas con `overflow: hidden` (la celda, el marco de la tabla y
el panel) y en la última fila de una tabla no se veía ninguna opción. De `.os` y
no del `body` porque ahí viven las variables de color: colgada del body salía
sin fondo y se leía la tarjeta de atrás a través de las opciones. Ya afuera se
ubica con las medidas del botón y lo sigue mientras está abierta, por evento de
`scroll` en fase de captura y por un bucle de cuadro, porque el evento no llega
cuando lo que se desplaza es un contenedor de adentro.

## Antes de nombrar una clase, buscala en `os.css`

La hoja es una sola y las clases son globales. Dos veces el mismo día una clase
nueva se comió los estilos de otra que ya existía: las columnas del gráfico se
llamaron `os-barra`, que es la barra de arriba del OS, y quedaron de ancho cero;
la fila que se abre en una tabla se llamó `os-cajon`, que es el cajón lateral de
los tableros, y apareció flotando contra el borde derecho de la pantalla.

**Y cuando dos clases pesan lo mismo, gana la que está más abajo.** Una variante
que se escribe antes que la clase base no pisa nada: hay que nombrar las dos
(`.os-gasto.os-gasto-factura`) o escribirla después.

## Una sola botonera de opciones

`app/os/Opciones.tsx`. Dos o tres opciones que se excluyen y se eligen de un
toque, en una píldora donde todas miden lo mismo: cómo es el puesto, si la
persona ingresó, cómo se leen los dos cuadrantes del Benziger. Estaba escrito
tres veces con el mismo markup y ya empezaba a tener tres tamaños.

**Cuál va en cada lado.** La botonera cuando las opciones son pocas y se
comparan entre sí, porque están todas a la vista. El desplegable cuando son
muchas o se reconocen por su punto de color.

**Todo lo que sea un botón usa `os-boton`**, y encima va la variante según qué
hace:

| Clase | Cuándo |
| --- | --- |
| `os-boton` | Lo secundario: cancelar, quitar, volver atrás |
| `os-boton-firme` | La acción principal de la pantalla: entregar, facturar, agendar |
| `os-boton-peligro` | Confirmar un borrado |
| `os-boton-marcado` | Un estado que alterna: "Sin contactar", "Sin cobrar", "Sin seguir" |

**Un enlace subrayado no es un botón.** `os-enlace-boton` existe, pero al lado
de un botón queda de otro alto y de otra forma, y el control se lee como otra
cosa según su estado. Si está en una fila de botones, es un botón.

El de copiar viene de la hoja del hub con su propio alto: adentro del OS se le
iguala, porque es el mismo botón.

## Las fotos se achican en el navegador, no en el servidor

Lo que dibuja la persona llega como fotos de teléfono por WhatsApp: cuatro megas
cada una, y del Bender son nueve. Comprimirlas del lado del servidor sería subir
treinta megas para tirar veintiocho, así que `lib/imagen-cliente.ts` las achica y
las une antes de que salgan del navegador de la evaluadora. Del Bender sube una
sola imagen con las nueve láminas, rotuladas A y 1 a 8.

Un PDF va tal cual: puede ser un escaneo de varias hojas y el lienzo solo sabe
de imágenes. Y si el navegador no puede decodificar el formato (un iPhone puede
mandar HEIC, que Chrome no lee), se sube el archivo original: es preferible
guardar cinco megas que perder el dibujo.

**Lo que hay que poder ver es el trazo, no el grano del papel.** Con el lado
largo en 860 píxeles una hoja A4 queda a unos cien puntos por pulgada, que
alcanza para leer un Bender; bajar más la calidad empieza a borrar el lápiz
claro.

## Las láminas de los tests no van al repositorio

Viven en el bucket privado, en `psicotecnicos/laminas/<test>/<n>.<formato>`, y
las sirve `/api/os/lamina/<test>/<n>` contra la sesión del OS. Estuvieron en
`public/` hasta el 20/8/2026, servidas por el hub de herramientas a cualquiera
que supiera la dirección.

Este repositorio es público y `public/` se entrega sin credencial. Las láminas
son material con derechos, y una que circula deja de servir para quien ya la
vio.

**Las del Bender son SVG y las dibujamos nosotros.** Son figuras geométricas,
así que en vez de escanear las tarjetas se midieron sobre ellas (cantidades,
separaciones, ángulos, radios) y se trazaron con esa geometría regularizada: las
tarjetas están hechas a mano y sus irregularidades pasarían al estímulo, donde
se leerían como error de quien copia. El programa que las genera está al lado de
ellas, en `laminas/bender/generar.py` del mismo bucket, y no en el repositorio:
en código, las figuras se leen igual que en la imagen.

**Las del Raven son recortes del escaneo, no dibujos.** Están en el bucket,
partidas en la matriz y las ocho opciones: `laminas/raven/<nn>-matriz.png` y
`<nn>-opcion-<k>.png`. Los recuadros se detectan solos (`recortar.py`, al lado
de ellas). Las sirve `/api/raven/lamina`, que abre con el token de quien rinde o
con la sesión del OS, para la vista de prueba.

**Vectorizarlas se probó dos veces y se descartó.** Trazar el contorno copia
también los defectos del papel: el óvalo sale mordido y los guiones desparejos.
Alisar el trazo mejora el escalón pero no eso. Y redibujarlas midiendo cada
elemento tampoco cierra: las líneas punteadas pasan por debajo de las figuras,
así que el reconocedor las lee partidas, y cada caso que se arregla destapa otro
en un vocabulario que cambia en las treinta y seis.

**El límite es el escaneo, no el formato: 1024 x 1536 para una hoja A4 son 124
DPI.** El óvalo de una opción mide 51 píxeles de ancho y su contorno cuatro. Al
tamaño en que se muestran se ven bien; ampliados, no hay técnica que recupere
detalle que no está en el archivo. Para verlas más nítidas hay que volver a
escanear a 300 DPI y correr el mismo recorte, que da piezas de 440 px.

## Lo que es criterio clínico se edita desde Configuración

Hay decisiones del motor que no son técnicas: dónde corta cada rango del Raven,
cuánto pesa cada indicador dentro de su competencia, qué dice cada lectura.
Escritas en el código, cambiarlas pedía una entrega, y el criterio de quien firma
el informe quedaba esperando a que alguien tuviera tiempo.

Van en la tabla `ajustes` (clave → jsonb) y se editan en Sistema →
**Configuración**, en pestañas (`?ver=baremos`): eran cuatro entradas de la
barra lateral para la misma pregunta. Las direcciones viejas (`/os/baterias`,
`/os/baremos`, `/os/ponderaciones`, `/os/redacciones`) redirigen a su pestaña. **El código
sigue trayendo el valor de fábrica y la tabla guarda la diferencia**: una clave
que no está significa "usá lo de fábrica", que no es lo mismo que un valor vacío,
y volver atrás es borrar la clave, no copiar los valores del día que se apretó el
botón. Si mañana cambian en el código, quien no tocó nada los recibe. Es la misma
forma que `evaluaciones.informe_listas`.

**Lo que llega se valida en la ruta, no en la pantalla.** Un baremo con dos
rangos que se cruzan deja puntajes que caen en dos rangos y otros que no caen en
ninguno, y eso rompe todos los informes a la vez.

**Y el estado de la pantalla vuelve a leer lo que manda el servidor.** Guardar
dibuja de nuevo del lado del servidor, pero eso no reinicia el estado de un
componente de cliente: sin eso, "volver a los de fábrica" borraba la fila y
dejaba la tabla mostrando los valores recién borrados. Se compara por valor y no
por identidad, porque cada dibujo manda un objeto nuevo y compararlo por
identidad borraría lo que se está escribiendo.

Son cuatro pestañas: qué toma y qué entrega cada batería, el baremo del Raven
(que mueve el rango que se nombra en el informe y el puntaje de habilidad
cognitiva), los pesos de los indicadores y los textos del diccionario. La de
baterías guarda en su propia tabla y no en `ajustes`, porque una batería es una
fila con su historia de precios y no un ajuste del motor.

**Un peso se guarda por nombre, no por posición.** `claveDePeso` arma
`test·competencia·indicador`: sumar un indicador arriba en el arreglo no puede
hacer que el peso que alguien le puso a la calidad del vínculo termine aplicado
al índice de egocentrismo.

**Lo que se decide es el aporte y no el peso.** Un peso de 2 no dice nada solo:
lo que importa es qué parte del puntaje de la competencia se lleva ese
indicador, y eso depende de los otros. La pantalla muestra el porcentaje y lo
recalcula mientras se escribe.

**Cero apaga un indicador y no lo esconde**: sigue en el detalle del informe con
su nivel y no entra al promedio, que es lo que se quiere cuando se desconfía de
uno. Tampoco cuenta como dato faltante, porque nadie lo está esperando. Una
competencia entera en cero se rechaza: el promedio se queda sin divisor y esa
competencia sale sin puntaje en todos los informes.

**En las redacciones, la condición y el texto viven separados.** `leer()` tiene
las condiciones (qué índice, contra qué corte) y `TEXTOS` tiene lo que se
escribe cuando cada una se cumple. Estaban juntos, y corregir una palabra
obligaba a entrar al algoritmo. La clave es el nombre de la rama
(`lambda-bajo`, `adjd-sobrecarga`), así que sumar una rama en el medio no corre
los textos que alguien ya editó de una lectura a otra, y cada una lleva su
`cuando` escrito en castellano: corregir un texto sin ver a partir de qué valor
entra es escribir algo que no se va a cumplir nunca.

**Un texto vacío en "qué dice" se rechaza**: la lectura entra igual en el
informe, así que quedaría el índice con su valor y sin nada que explique qué
significa. Vaciar la recomendación sí vale, y hay lecturas del diccionario que
van así.

Al tocar `leer()` hay que comprobar que los informes no se muevan: se vuelcan
los de las 42 fichas con sumario antes y después y se comparan. La separación de
condiciones y textos se hizo con ese control, y dio los 42 idénticos.

**Lo que entrega una batería son las secciones del informe**, con el nombre que
llevan ahí: la recomendación de incorporación (el nivel de ajuste, que es el go
o no go y se entregaba sin estar declarado), el mapa de competencias con su
análisis cualitativo, las recomendaciones para su líder, y el informe de
potencial, que sale del análisis discursivo y por eso lo pide.

El documento entero no está en la lista porque es el continente: lo que se
elige es qué trae adentro. El sumario estructural tampoco, porque no se
entrega: son los índices crudos del protocolo, que se leen en la ficha y nunca
estuvieron en el documento del cliente. Y el perfil Benziger tampoco, porque no
lo decide la batería sino el pedido (`pedidos.con_benziger`), igual que su
administración.

**Qué toma y qué entrega una batería se tilda, no se escribe.** El vocabulario
está en `lib/baterias-contenido.ts` y es cerrado, porque el nombre no es
decorativo: la entrevista se cierra sola cuando están administrados los tests de
la batería (`lib/entrevista-completa.ts`) y ahí se los busca por su nombre
exacto. Escrito a mano, cada batería llegaba a nombrar lo mismo de otra manera y
el cierre dejaba de encontrarlos.

Dos combinaciones las rechaza la ruta, porque no fallan al guardarse sino meses
después en la ficha de alguien: los dos tests de manchas juntos, donde
`proyectivoDeLaBateria` toma el primero del arreglo y la evaluadora ve el que
nadie eligió, y el sumario estructural sin ningún proyectivo que lo sostenga.
Se guarda en el orden del catálogo y no en el que se tildó, así dos baterías con
lo mismo se leen igual en la cotización y en el portal.

**Vale para adelante**, como el precio: una evaluación ya tomada conserva lo que
se le tomó, que son sus marcas de administrado.

**El portal lee las baterías de donde se editan.** El nombre, qué incluye, para
quién se recomienda y cuánto dura salen de la tabla `baterias`
(`lib/baterias-portal.ts`), que es la que se edita en Configuración. Hasta el
25/8/2026 `lib/baterias.ts` era una copia fija con sus propios textos: corregir
la duración había que hacerlo en dos lados y solo uno se podía tocar sin una
entrega. De esa copia queda el respaldo, para que un formulario de pedido no
quede sin baterías si la lectura falla.

Los tres textos son obligatorios porque son lo que el cliente lee al elegir; la
duración puede faltar, que es distinto de valer cero.

## Los archivos se eligen o se sueltan, en todos lados

`app/os/SoltarArchivo.tsx` envuelve el control que ya había y le suma recibir lo
que se le tire encima. Está en las nueve fotos del Bender, el dibujo, el informe
del Benziger y el CV del cajón del candidato; la tarjeta de alta tiene su propia
caja porque ahí el archivo es lo primero que se carga.

**No reemplaza al botón, lo acompaña**: adentro sigue el control de siempre, y
el marco punteado aparece solo mientras se arrastra algo encima. Un marco
permanente en cada test convertiría la hoja de la entrevista en una grilla de
recuadros.

**Cuando el archivo viaja en un formulario, el soltado se mete en el `<input
file>`** con un `DataTransfer`: si no, queda leído y se pierde al guardar.

## Para agendar hacen falta fecha y modalidad

`faltaParaAgendar` en `Entrevistas.tsx`, y la cumplen los dos caminos: el botón
"Agendar" queda apagado y el arrastre a Agendadas se rechaza con el motivo. Una
entrevista agendada sin día es lo mismo que una sin agendar, y a la persona hay
que decirle cuándo y dónde.

**Por citar se ordena por lo que espera desde la solicitud, no desde la
entrevista.** Ahí la fecha se está cargando en ese momento: midiendo contra
ella, la tarjeta saltaba de lugar apenas se elegía el día y había que ir a
buscarla a otra parte de la columna para terminar de completarla. Lo que la
mueve de verdad es agendarla, que la cambia de columna.

**Y la fecha se puede cambiar desde la ficha** (`Cuando.tsx`, pestaña
Entrevista): las entrevistas se reprograman, y hasta ahora eso obligaba a
volver al tablero a buscar la tarjeta. Va detrás de "Reprogramar" y no como
campo abierto, porque es el dato que más se lee del encabezado.

## El Raven de la hoja se mira solo

`app/os/psicotecnicos/entrevista/[id]/Raven.tsx`. El test lo responde la persona
por su enlace y dura cincuenta minutos (`MINUTOS` en `lib/raven.ts`), así que la
evaluadora le manda el enlace y se pone a escribir la entrevista: no puede
quedarse recargando para ver si arrancó.

**Lo que se dibuja sale del sondeo, no de la prop del servidor.** Cada seis
segundos se pregunta `/api/os/raven-estado`, que devuelve el estado, cuándo
abrió y, si ya entregó, cuánto tardó y qué dio. Antes ese sondeo solo avisaba
que algo había cambiado y pedía la pantalla de nuevo: cuando ese redibujo no
llegaba, el reloj recién aparecía si alguien recargaba a mano. El servidor ahora
pone solamente la primera pintura.

Igual se sigue pidiendo la pantalla cuando el estado cambia, porque el resto de
la hoja también cambia: la evaluación pasa a Por analizar cuando el Raven era el
último test que faltaba.

**El reloj se cuenta contra la hora de arranque que fijó el servidor**, no
descontando un segundo por vuelta: con la pestaña en segundo plano el navegador
frena los temporizadores y la cuenta se atrasa. Por lo mismo se vuelve a
preguntar al volver a la pestaña.

**Entregado, el tiempo y el puntaje van juntos**, en la misma columna donde
estaba el reloj: la pregunta es una sola, cómo le fue. Media hora puede ser
rápido o lento según el puntaje, y el puntaje solo esconde a quien lo sacó
contra reloj.

## El baremo propio del Raven se cuenta solo

`lib/raven-propio.ts`. Qué tan raro es cada rango sale hoy de `RANGOS`, en
`lib/raven.ts`, calculado sobre los primeros 35 candidatos. Al lado, en
Configuración, se cuenta la frecuencia de todos los Raven cargados, con cuántos
casos lleva: **esa todavía no rige**. Reemplaza a la escrita el día que se
llegue a los 200 casos y se cambien esos números a mano.

Son dos columnas al lado, y no una que pise a la otra, para poder ver cuánto se
separan antes de decidir. El contador está porque "1 de cada 2" sobre catorce
personas se lee con la misma confianza que sobre doscientas.

Se cuenta contra los cortes que rigen y no contra los de fábrica: mover un corte
cambia cuánta gente cae de cada lado, que es justo lo que se está decidiendo.

**La frecuencia no va adentro del texto que se guarda.** `textoDelRango` deja
"Rango III · Término medio" y nada más: metida ahí quedaría congelada la del día
que se cargó la medición, y el día que cambie habría que reescribir todas las
mediciones viejas para que no convivan dos. Las 39 que ya la tenían adentro se
normalizaron el 25/8/2026.

## Un protocolo que no alcanza no da puntaje

`protocoloAlcanza()` en `lib/competencias.ts`. Las competencias que salen del
test de manchas se calculan solo si el protocolo puede sostenerlas: menos de
catorce respuestas en Rorschach (la regla de Exner, por debajo no se interpreta
y se vuelve a tomar), menos de seis en Zulliger, o Lambda por encima de uno.

**Lambda alto es el corte que importa y el que faltaba.** Pasado uno el estilo
es evitativo: la persona simplifica lo que ve, y los indicadores de emoción y de
vínculo quedan vacíos porque el protocolo no los muestra, no porque el rasgo no
esté. Sin ese corte, la ausencia de indicadores negativos se leía como un buen
resultado.

Se vio comparando contra los informes escritos a mano: en un protocolo con
Lambda 1,4 el motor daba 67 en habilidad interpersonal y 100 en proactividad,
mientras la psicóloga escribía que las habilidades interpersonales estaban por
debajo de lo esperado. El mismo motor, contra un protocolo de veintiuna
respuestas y Lambda normal, coincidió con ella en las cinco competencias, todas
en la misma banda. De cuarenta y dos protocolos migrados, cinco caen bajo el
corte.

**Y el informe dice por qué.** "Sin datos" a secas invita a pensar que se
olvidaron de cargar algo; lo que pasa es que lo cargado no permite afirmar nada,
y eso es una información distinta.

## El perfil joven del Benziger va en la escala del adulto

`Cerebro.tsx` lo multiplica por cuatro, que es lo que hace la plataforma de
Benziger con el mismo dato: se dedujo midiendo los vértices de veinte gráficos
suyos contra los valores del PDF, y el cociente entre las dos escalas dio 4,000
en todos con error menor al 0,1 %. El cuestionario joven se responde sobre menos
ítems, así que sin el factor su polígono queda hundido contra el centro y las
dos figuras no se pueden comparar, que es lo único que el gráfico quiere
mostrar.

Un valor que se pasa de la escala tampoco se aplasta contra el anillo exterior:
la plataforma no recorta, y con el corte en 120 todo joven de 30 para arriba,
que es corriente, daba la misma figura. Se corta recién en el borde del lienzo.

**Es un solo gráfico para todos lados.** `Cerebro` vive dentro de `Documento`, y
`Documento` es el que se ve en la ficha, en la vista para imprimir y en el
portal del cliente: no hay una segunda versión del informe que pueda quedar con
otra escala.

## El Benziger existe solo donde se pidió

Lo agrega el pedido (`pedidos.con_benziger`) y no la batería. En las
evaluaciones que no lo llevan, la pestaña de la ficha salía igual y vacía, el
aviso de faltantes reclamaba el cuadrante preferente, y las dos cosas se leían
como trabajo pendiente de algo que nadie pidió. Ahora la pestaña no está
(`llevaBenziger` en `lib/informe.ts`) y el faltante tampoco.

**Una pestaña que no le corresponde a la ficha cae en Datos**, igual que una que
no existe: la dirección puede venir guardada de otra persona.

## El análisis discursivo lo ubica la evaluadora

Está en la batería 3 desde siempre y salía en el informe escrito a mano: la
pirámide de cuatro niveles del modelo de Elliot Jaques con el escalón marcado, y
los dos párrafos de capacidad potencial. En el OS no había dónde cargarlo, así
que la batería más cara era la única que no se podía terminar desde acá.

**El nivel no se calcula.** Se toma sobre unos cinco minutos de discurso y lo
ubica quien lo escuchó: el sistema guarda su lectura (`analisis_discursivo`) y
la dibuja. Los dos párrafos también los escribe ella, y salen solo si están.

**La pirámide es un dibujo y no una imagen** (`Piramide.tsx`, trapecios
recortados con `clip-path`): el informe se imprime a PDF y se lee en pantalla, y
una imagen queda pixelada al ampliarla y sin texto que se pueda buscar ni leer
en voz alta. Es el mismo componente en la ficha y en el informe, y en la ficha
cada escalón es un botón: se elige mirando lo que el cliente va a ver.

Tres cosas del dibujo que costaron y conviene no deshacer:

- **El ancho de cada trapecio sale de su altura, no de su número de orden.** Por
  orden, el escalón que necesitaba dos renglones de texto crecía y sus lados se
  salían de la recta. Por eso los cuatro miden lo mismo y esa medida está en el
  componente: si un texto dejara de entrar en dos renglones hay que subir
  `ALTO`, no dejar que la fila crezca sola.
- **Es una pirámide truncada, sin punta de fondo.** El informe que se entrega
  hoy la dibuja con dos figuras de pendientes distintas, una punta empinada
  detrás de los escalones, y se probó de las dos maneras: con una sola silueta,
  el escalón más alto mide treinta y siete píxeles y "Liderazgo 2" sale cortado;
  con la punta detrás, aun haciendo coincidir las dos bases, se ven dos dibujos
  superpuestos y no uno. La figura es una sola y sus cuatro lados caen sobre una
  recta. Lo que define cuánto se abre es `CORONA`, el ancho de arriba, y lo manda
  el nombre más largo del escalón más alto.
- **El recuadro del elegido es `outline` y no borde.** Un borde le suma dos
  píxeles a la fila y ese escalón deja de encajar en la pirámide.

Va solo donde la batería lo incluye, en cuatro lugares: la hoja de entrevista lo
lista con su estado, la pestaña Tests lo carga, la pestaña Informe lo muestra
con su punto de color entre los tests de la batería, y el informe lo publica.
Volver a apretar el escalón que ya estaba lo desmarca, que es cómo se corrige
sin tener que elegir otro que no corresponde.

**Deja marca en el informe pero no cierra la entrevista.** El escalón se ubica
después, al analizar, así que esperarlo dejaría la entrevista abierta con la
persona ya saludando.

**Los dos párrafos van siempre, con o sin texto.** El capítulo tiene tres partes
y una que falta se ve como una parte que falta, no como una que no existe: sin
cargar dicen "Sin contenido" y los tres faltantes salen en el aviso de quien
codifica.

**Los capítulos del informe se numeran solos.** Escritos a mano, un informe sin
Benziger saltaba de 04 a 06, y ahora hay dos capítulos que pueden faltar.

## Una sección del informe sale si tiene algo que decir

El Benziger se dibujaba por existir su fila, no por tener datos. Una fila
cargada a medias, con los cuatro cuadrantes en null, sacaba la sección entera:
el cerebro sin una sola figura adentro, los cuatro títulos alrededor y el
renglón "Cuestionario Benziger" en las técnicas usadas. El cliente leía
"estilos de pensamiento predominantes" sobre un gráfico vacío.

**Preguntar si el objeto está no alcanza**: `fila('Total adulto')` devuelve los
cuatro cuadrantes igual cuando los cuatro son null, y eso es verdadero. Hay que
preguntar si alguno trae un número (`tieneAlgo` en `lib/informe.ts`).

La técnica va con la misma condición: una que no dejó un solo resultado no se
puede declarar como usada. Lo que falta lo sigue diciendo el aviso de faltantes,
que es de quien codifica y no del cliente.

De los 41 informes con protocolo, uno solo cambió por esto (25/8/2026).

## El informe del Benziger se lee y no se guarda

El PDF que devuelve la licencia entra, se le sacan sus 69 datos y el archivo no
se sube a ningún lado: de él quedan el nombre y la fecha. El original vive en la
plataforma Benziger, así que guardarlo acá no agregaba respaldo y sí sumaba una
copia del perfil completo de una persona identificable. Si algún día hay que
volver a leerlo, se baja de la plataforma y se sube de nuevo por el mismo botón.

Como no queda ningún archivo, tampoco hay nada que abrir: el bucket no tiene
carpeta `benziger/`, la ficha muestra el nombre del informe con la marca de
leído, y la ruta que firmaba una dirección para verlo se borró junto con
`enlaceDelInforme`.

**Por eso una lectura incompleta se rechaza.** Antes el lector seguía de largo
cuando no encontraba un rótulo y la fila entraba con campos vacíos: el problema
recién aparecía en el informe terminado. Ahora `faltantesDe` exige los datos que
tienen que estar y `descuadresDe` comprueba las tres cuentas que el informe trae
hechas (los tres bloques del adulto dan el total del adulto, las cuatro filas de
estado emocional dan su TOT, y los puntos de estrés de la página 3 son la suma
de los acontecimientos de la página 5). Un campo vacío se ve; un número
equivocado no, y ese cruce es lo único que lo delata.

Al tocar el lector hay que correrlo contra los informes de prueba antes de
subir: doce informes reales pasan sin faltantes ni descuadres, con perfiles
preferentes FI, BI y BD.

## El orden de los tests lo decide quien toma la entrevista

`evaluaciones.orden_tests`, arrastrando las tarjetas en la hoja de entrevista.
La batería dice qué se le toma, no en qué orden: si la persona llega tensa
conviene empezar por el gráfico, y si hay poco tiempo se manda el Raven primero
para que corra mientras se hace otra cosa.

**Se guarda por evaluación y no por evaluadora**, porque la decisión es sobre
esa entrevista. **Lo que no está en el orden guardado va al final**, en el de la
batería: sumarle un test a la batería no puede esconderlo de las entrevistas que
ya tenían su orden elegido, y un nombre guardado que ya no está en la batería se
descarta.

**El marco de la tarjeta lo dibuja el componente de cliente y no el servidor.**
El número es la posición, así que moviendo tarjetas ya numeradas el 01 viajaba
con su test y la lista quedaba 02, 01, 03.

El arrastre es el mismo de las listas del informe, con sus mismos cuidados: se
toma del agarre (la tarjeta tiene botones y campos adentro), el lugar se cede al
pasar la mitad del vecino y el reacomodo se anima midiendo antes y después.

## La entrevista se cierra sola cuando ya se tomó todo

`lib/entrevista-completa.ts` mira, después de cada cambio, si quedan tests de la
batería sin administrar. Si no queda ninguno, la evaluación pasa de Por
entrevistar a Por analizar. El botón "Entrevista tomada" sigue estando para
cerrarla antes; lo que deja de pasar es que olvidarse lo deje todo en el limbo.

**Solo cuentan los tests que dejan marca.** La entrevista por competencias y el
análisis discursivo no la dejan, así que exigirlos sería exigir algo que nadie
puede tildar. El Benziger sí cuenta, y no está en la batería: lo agrega el
pedido cuando lo lleva (`pedidos.con_benziger`), y su marca vive en la
evaluación como la del Bender.

**El chequeo nunca tumba lo que se estaba guardando.** Va detrás de un try, y si
falla se registra y se sigue: es un paso de más, y que rompa no puede hacer
perder la marca que la evaluadora acaba de poner. Ya pasó una vez, con la
relación del Raven leída como lista cuando PostgREST la devuelve como objeto.

## Una etapa sin pantalla es una evaluación perdida

`ETAPAS` y `SECCIONES` tienen que cubrir lo mismo. "Seguimiento" existió como
etapa y como botón sin tener sección: apretarlo sacaba la evaluación de todas
las listas, `/os/psicotecnicos/seguimiento` respondía 404 y no había forma de
volver desde la interfaz. Cuando se le hizo su pantalla, el 21/8/2026, había
tres personas atrapadas ahí.

Al sumar una etapa hay que sumar su columna en el tablero de su sección y, si
la sección es nueva, su entrada en la barra lateral (`app/os/Shell.tsx`, que
tiene su propia lista).

**Al sacar una sección de la barra hay que dejarle su redirección.** Hoy
`/sin-asignar`, `/por-citar`, `/por-entrevistar`, `/por-analizar` y
`/seguimiento` redirigen a la sección que las absorbió: la ficha vuelve por esas
direcciones cuando se abrió desde esa etapa, y sin ellas el botón de volver da
404.

## Las etapas y las secciones no son lo mismo

`ETAPAS` son los estados del pipeline, los que viven en la base. `SECCIONES`
(en `lib/psicotecnicos-tipos.ts`) son las entradas de la barra lateral, y una
sección puede juntar varias etapas: **Entrevistas** trae "Sin asignar", "Por
citar", "Por entrevistar" y "Por analizar" juntas, una por columna de su
tablero.

Agrupar en la navegación no cambia el pipeline: las seis etapas siguen enteras
en la base. Hoy son dos secciones, con cuatro y dos etapas cada una.

**Repartir es la primera columna de Entrevistas, no una pantalla.** Lo fue
hasta el 27/8/2026 (`Reparto.tsx`, borrado): en pantallas separadas había que
salir del tablero para ver quién no tenía dueño y volver para ver qué se hizo
con esa persona.

- **La primera columna es de las dos; las otras tres, de cada una.** Sin
  asignar muestra todo lo que no tiene dueño, esté en la etapa que esté, porque
  repartir es trabajo del equipo. Citar, agendar y analizar muestran lo de quien
  mira. Lo decide `visiblesEn` en `app/os/psicotecnicos/datos.ts`.
- **De ahí no se sale arrastrando: se elige a quién.** Un arrastre no puede
  decir de quién es. El botón lista los nombres con su carga al lado, que es el
  único momento en que esa cuenta hace falta: repartir sin ver contra qué se
  reparte es repartir a ciegas. La carga se cuenta sobre todo lo abierto y **no**
  sobre lo que dejó el filtro por cliente, que diría que está libre alguien con
  doce de otra empresa.
- **Al revés sí**: arrastrar una tarjeta de vuelta a la primera columna le
  suelta la dueña. Sin ese gesto, un reparto equivocado solo se podía corregir
  desde la ficha.
- **Asignar mueve a Por citar** si la evaluación estaba en la etapa Sin asignar;
  una que venía de más adelante se queda donde estaba, porque lo que le faltaba
  era dueña y no volver a empezar.

**Tablero o tabla según qué se hace ahí.** Tablero donde el trabajo es mover
una ficha de columna: Entrevistas (`Entrevistas.tsx`), donde la etapa se cambia
arrastrando. Tabla donde el trabajo terminó y lo que se hace es consultar:
Entregados (`Entregados.tsx`), que además trae el seguimiento como una columna.
`Tabla.tsx`, que servía a todas las secciones a la vez, se borró el 24/8/2026;
lo que compartía quedó en `piezas.tsx`.

**La facturación vive entera en su sección.** Entregados no lleva columnas de
factura ni de cobro: un comprobante junta a varios candidatos de un cliente, así
que dos columnas de Sí y No por persona no dicen a cuál de todos hay que ir a
reclamarle. Lo que falta facturar y lo que falta cobrar se mira en Facturación,
donde está separado por bloques y con su total.

**En una tabla de consulta no se edita.** Entregados muestra el seguimiento y
lo que contestó la empresa como dato, no como control: lo que se carga junto se
carga desde la ficha de la persona, que es donde están la fecha de ingreso que
agenda los noventa días y lo que dijeron. Con un botón por columna se cambiaba
de a un campo y quedaba la mitad del seguimiento sin cargar.

**Una tarjeta de tablero se define fuera de su componente.** Definida adentro,
React la trata como un tipo nuevo en cada dibujo y desmonta el subárbol entero:
se borra lo escrito en un campo y se pierde el clic en un botón, porque el
elemento que recibió el `mousedown` ya no existe al soltar. Costó una tarde.

**Y el estado de "se está arrastrando" se apaga en la columna, no en la
tarjeta.** Al soltar, esa tarjeta se desmonta de su columna vieja antes de que
llegue el `dragend`, así que ese aviso no lo recibe nadie: la que aparece en la
columna nueva se queda a media opacidad hasta que se arrastre otra. El
`onDragEnd` de la tarjeta se queda igual, para cuando se suelta fuera de toda
columna y no hay movimiento que la desmonte. Vale para los tres tableros
(`Entrevistas.tsx` y `Tablero.tsx`).

## Un tema de reunión y una tarea no son la misma anotación

Las dos viven en `public.pendientes` y las separa `para_reunion`, pero no se
editan igual, y por eso `Pendientes.tsx` dibuja distinto cada lista.

**Un tema no tiene dueño, ni fecha, ni estado.** Es algo para hablar entre las
tres, y mientras esté en esa lista no es de nadie. El tilde es de los temas, que
están hablados o no.

**Y no se pasan de una lista a la otra.** Hubo un botón para hacerlo y se sacó
el 27/8/2026: convertir un tema en tarea no es moverlo, es inventarle dueño,
fecha y estado, y al revés es tirarlos. Se anota en la lista que corresponde.

**Los temas se ordenan arrastrándolos** (`pendientes.orden`), porque el orden en
que se anotaron no es el orden en que conviene hablarlos. Al soltar se manda la
lista entera: fila por fila, una petición que falla deja dos temas en la misma
posición. Las tareas no se arrastran, que su prioridad ya la lleva el
vencimiento.

**Una tarea tiene dueño, vencimiento y estado**, y el estado es de tres valores
(Pendiente, En curso, Hecha): "no está hecha" no distingue lo que nadie empezó
de lo que alguien ya tiene entre manos, y en la reunión las dos se volvían a
repartir. `hecha` sale del estado y se escribe en la ruta, de un solo lado: con
dos caminos quedaba una tarea tachada que seguía diciendo "Pendiente".

**Vencida se muestra pero no se guarda.** Si la fecha pasó y la tarea no está
hecha, el sello dice "Vencida" en rojo (`estadoVisible`) y la fecha se pinta
igual; debajo sigue estando el estado elegido, y la tarea vuelve a decirlo sola
en cuanto se le corre la fecha. Guardarlo obligaría a escribir en la base todas
las noches para que una tarea amanezca vencida, y dejaría de ser cierto en
cuanto alguien corriera la fecha: es la misma decisión que la prioridad del
tablero.

Vencida entra en la lista del desplegable solo cuando la tarea lo está, porque
si no el sello no encontraría su nombre ni su color. Elegirla no hace nada: el
desplegable solo avisa cuando lo elegido es distinto de lo que ya muestra, y lo
que de verdad la saca de ahí es otra fecha o darla por hecha.

**Y los tipos van en `lib/pendientes-tipos.ts`.** `lib/pendientes.ts` lleva
`server-only` y el panel es un componente de cliente: importar de allá rompe el
build entero con un "Invalid hook call" que no nombra el archivo culpable. Es la
misma razón por la que existen `lib/comercial-tipos.ts` y
`lib/clientes-tipos.ts`.

## El tablero de la home no es el pipeline

`app/os/Tablero.tsx`, en Inicio. Tres columnas: Backlog, Hoy y En curso. Viven
en `evaluaciones.tablero` y **no tocan la etapa**: arrastrar ahí dice en qué
anda la evaluadora, no que la evaluación avanzó de estado. La etapa se sigue
cambiando en Entrevistas, que es el tablero del circuito.

Existe porque la lista "Psicotécnicos en curso" decía lo mismo todos los días:
era el estado del pipeline y no el del trabajo, y con una evaluación abierta en
la mano lo que hace falta saber es qué agarrar cuando esa termine.

**Sin columna guardada, una evaluación está en el backlog.** La columna se
escribe solo al arrastrar, así lo que entra aparece sin que nadie lo mueva. Hoy
es una elección deliberada: lo que se sacó del backlog para hacer en el día.

**Lo agendado para hoy entra solo en Hoy, y sale pintado.** Una entrevista es
una cita a una hora: no se elige cuándo hacerla, así que su tarjeta va a esa
columna sin que nadie la arrastre, es azul, lleva la hora en grande y abre la
hoja de la entrevista. Al lado de un análisis, que sí se acomoda, la diferencia
tiene que verse antes de leer el nombre. Deja de ser cita cuando la entrevista
se toma: ahí vuelve a ser trabajo y cae donde le toque.

Por eso Inicio ya no tiene su propio panel de "Entrevistas de hoy": decía lo
mismo un renglón más arriba.

**No hay columna de terminadas.** Un informe que se subió al portal ya está
listo: la tarjeta se va del tablero cuando la evaluación se entrega. Una cuarta
columna de hechas se llena sola y se lleva un cuarto de la pantalla para mostrar
algo que nadie necesita mirar; lo entregado está en Entregados. Se probó con
ella y duró una tarde.

**La prioridad se calcula mientras nadie opine.** Null en la base significa "la
que le toca por espera": alta a los diez días de solicitada, media del quinto al
noveno, baja antes (`prioridadPorDefecto` en `lib/psicotecnicos-tipos.ts`).
Guardada, quedaría clavada en la banda del día que se escribió y el paso del
tiempo no la movería. Por eso el desplegable ofrece "por espera" además de las
tres: sin esa salida, tocarlo una vez la fijaba para siempre. La calculada se
dibuja más apagada que la decidida.

## Cada texto del informe muestra de dónde salió, y solo a quien evalúa

Los tres grupos del análisis y las recomendaciones al líder llevan, al final de
cada oración, el índice que la disparó con su valor: verde si cayó dentro de lo
esperado y rojo si lo cruzó, con la misma banda que pinta la hoja del sumario.
Lo pidió la psicóloga (28/8/2026): revisando el informe quiere ver el respaldo
de cada párrafo sin volver al sumario a buscarlo.

**Es de quien firma y no del cliente.** `Documento` pasa `respaldos` únicamente
cuando recibe `editar`, que es lo que distingue la ficha de la vista para
imprimir y del portal: esas dos dibujan la misma lista sin un solo sello.

**La clave del mapa es el texto, no la posición.** Las listas se reordenan y se
editan, así que por posición el sello terminaría al lado de otra oración. Un
texto corregido a mano deja de encontrar su respaldo y sale sin sello, que es lo
correcto: ya no es lo que dijo la codificación.

**El valor se lee del final de la cadena y solo si lo de adelante no tiene
dígitos.** Las lecturas traen el valor escrito para leerse ("Xu 0,35", "+3,5",
"W:M 9:3"), y una razón como 9:3 no se compara contra una banda: queda sin
pintar, con el índice dicho en el título.

**Afr se pinta con la banda de su estilo.** No sale de un corte guardado como
las demás: lo que se espera de la proporción afectiva cambia según la persona
sea introversiva (0,53 a 0,78), ambigual (0,53 a 0,83) o extratensiva (0,60 a
0,89), y por eso vive en `AFR_BANDA` y se pide con `bandaDeAfr(estilo)`. Hasta
el 28/8/2026 quedaba sin pintar en la hoja por depender del estilo; con el
estilo a mano se puede pintar sin que la hoja y el informe se contradigan.

## Las cuatro listas del informe las puede escribir la evaluadora

Recomendaciones al líder, Desarrollo destacado, Desarrollo esperado y Necesidad
de desarrollo salen de la codificación, y desde el 24/8/2026 se pueden ordenar,
corregir y ampliar desde la ficha. Lo que ella deja escrito se guarda en
`evaluaciones.informe_listas` (`supabase/informe-listas.sql`) y pisa lo
calculado.

**Una clave ausente no es lo mismo que una lista vacía.** Ausente significa
"usá lo calculado"; vacía significa "esta sección va sin ítems", que es una
decisión. Por eso `lib/informe.ts` pregunta si es un arreglo y no si tiene
largo, y por eso volver atrás es borrar la clave (el botón "Volver a lo
calculado", que manda `null`) y no dejarla en cero.

**Una lista escrita a mano deja de seguir a la codificación.** Cambiar un
determinante ya no la mueve, así que el documento la marca como editada: sin esa
marca, la evaluadora recodifica y no entiende por qué el informe no cambia.

Los controles solo salen en la ficha, que es donde se trabaja el informe:
`<Documento>` los dibuja cuando recibe `editar`, y la vista para imprimir y el
portal del cliente no lo pasan.

**El botón de editar va arriba**, en el encabezado del grupo al lado de la
cuenta. Al pie de la lista había que leer las seis oraciones enteras para
encontrarlo. Por eso el recuadro del grupo lo dibuja `Listas` y no `Documento`:
el encabezado tiene que salir del mismo lado que el estado que ese botón abre.

**El renglón se arrastra desde su agarre y no desde el texto.** El `li` es
arrastrable siempre (hace falta para que el navegador empiece el arrastre), y el
`dragstart` se cancela cuando el gesto no arrancó en el agarre; sin eso,
arrastrar sobre las palabras para seleccionarlas movía el ítem de lugar. Qué
tocó el gesto se anota en el `pointerdown`, que llega antes que el `dragstart`.

**Los renglones se vuelven a medir después de cada cambio.** Arrastrar no crea
ni destruye cajas de texto: les cambia el contenido. Midiendo solo al montarse,
el ítem largo que subía aparecía cortado a la mitad.

**El reacomodo se anima midiendo, no con una transición de CSS.** Los renglones
cambian de lugar porque cambia el orden del arreglo, y eso el CSS no lo puede
interpolar. Antes de tocar el estado se anota dónde está cada uno; después del
dibujo se mide dónde quedó y se recorre la diferencia con `animate`. Dos
cuidados: la animación anterior se cancela antes de medir, porque mientras corre
el navegador devuelve la posición a mitad de camino; y cada ítem lleva un número
propio, porque comparar por posición sería comparar cada renglón contra otro.

**El lugar se cede al pasar la mitad del renglón vecino, y no al tocarlo.**
Cediéndolo al tocarlo, los dos ítems se intercambian, el de abajo vuelve a
quedar bajo el puntero y se intercambian de nuevo: la lista tiembla sin avanzar.

**Soltar se frena con `preventDefault`.** El arrastre lleva un texto: sin
frenarlo, soltar sobre un campo lo escribe adentro. Y frenarlo es además lo que
le dice al navegador que el destino era válido, así el renglón se queda donde lo
dejaron en vez de volar de vuelta al lugar del que salió.

## El monotributo se mira contra los últimos doce meses

`lib/monotributo.ts`, y se ve en **Costos**: no es una tarea del día sino la
salud del año. Facturación resuelve qué se emite y qué se cobra; en Costos se
mira qué deja el trabajo y hasta dónde se puede facturar sin cambiar de régimen.

**Son dos dineros distintos y por eso están en dos pantallas.** Los
psicotécnicos los factura y los cobra cada evaluadora por su cuenta, así que esa
pantalla muestra lo de cada una. Lo que se cotiza y se gana es del estudio y se
reparte entre los tres, así que **Costos no tiene dueño: todos ven todo**, y las
dos categorías de monotributo se ven juntas, porque una cerca del tope cambia
con cuál de las dos conviene facturar lo que sigue.

**Un trabajo por fila, con lo cotizado, lo facturado y lo que costó.** Esas
tres cosas vivían en tres lugares y ninguna pantalla las tenía juntas, que es lo
único que contesta qué quedó. El costo de la fila se abre y muestra los gastos,
con su alta y su baja, y las facturas de ese trabajo: media docena de gastos
chicos a la vista hacían de la pantalla una lista de gastos con el resultado
escondido en el medio.

**La fila es el trabajo y no la factura.** Un trabajo se factura en varios
comprobantes, porque el ciclo se reparte entre los tres y cada uno emite el
suyo; con una fila por factura, el costo aparecería tres veces y el resultado
sería tres veces mentira. El vínculo lo pone `facturas.cotizacion_id`
(`supabase/factura-cotizacion.sql`), que va en la factura porque al revés no
entraría, y admite null: una factura de un servicio que nunca se cotizó
formalmente sigue siendo una factura.

**Los servicios también se facturan, y desde Costos.** Un ciclo de encuentros o
un trabajo de estructura lo emite una de las dos con su CUIT, así que ese
ingreso va contra su monotributo igual que un psicotécnico: sin poder cargarlo,
la cuenta del tope mentía por abajo, que es la forma peligrosa de mentir. Se
carga y se cobra en Costos; Facturación es la cola de los psicotécnicos y nada
más.

**Las dos clases de factura se distinguen por sus renglones, no por una marca.**
Un comprobante de psicotécnicos siempre lleva sus candidatos adentro
(`factura_items.evaluacion_id`) y uno de servicios no lleva ninguno. Cada
pantalla filtra por eso.

**En una factura de servicios el importe se escribe.** En las del pipeline se
recalcula del lado del servidor desde las evaluaciones tildadas, porque hay de
dónde; en un servicio no hay nada que calcular: lo que se factura es lo que se
acordó.

La pantalla va en ese orden: primero los psicotécnicos, que es de donde sale el
trabajo de todas las semanas, y después los servicios de Campos HR con sus
cuatro cifras y sus oportunidades.

Además de los tres números, cada panel trae el gráfico de lo facturado mes a
mes: dice si el trabajo viene parejo, si hubo un mes que se llevó medio año o si
hace tres que no entra nada. **El gráfico va por año comercial, de enero a
diciembre, y la cuenta del tope por los doce meses corridos**: son dos preguntas
distintas y cada una tiene su ventana. Contra sí mismo el año se compara mes a
mes; una ventana que se corre cada mes no deja comparar dos veces lo mismo.

**Cada mitad de Costos abre con su línea** (`os-rotulo-seccion`): son dos
dineros que no se mezclan, y un rótulo gris chico no alcanzaba para decir que
ahí empieza otra cosa.

**Cada barra va partida en dos**: lo que salió de los psicotécnicos y lo que
salió de los servicios de Campos HR. Es lo que cada una necesita para saber de
dónde le vino el mes, y las dos mitades suman lo que va contra su tope.

Las barras se miden contra el mes más alto y no contra el tope, que aplastaría
un año en una línea de nada. Los meses que no llegaron van apagados, para no
leerlos como meses sin trabajo, y un mes sin facturas no dibuja barra, porque
con una barra mínima doce meses vacíos se leían como doce meses con algo.

Las dos facturan como monotributistas y pasarse del tope no es una multa: es
quedar fuera del régimen y tener que inscribirse en el general. Por eso la
pantalla muestra, para cada una, lo del mes, lo del año y **lo de los últimos
doce meses corridos**, que es lo que mira ARCA para recategorizar (enero y
julio), y cuánto le queda hasta el tope de su categoría.

**Los topes son números escritos y hay que actualizarlos.** ARCA los mueve dos
veces al año con la inflación del semestre anterior. Los cargados rigen desde el
1/8/2026; `VIGENTE_HASTA` dice hasta cuándo sirven.

**De la I a la K son solo para venta de cosas muebles.** Quien presta servicios
no puede categorizarse más arriba de la H, así que el desplegable ofrece hasta
ahí y la ruta rechaza el resto: pasada la H no hay categoría que lo aguante.

**Solo cuenta lo emitido y en pesos.** Un borrador o una factura rechazada no
son un ingreso, y una en dólares no se puede sumar sin convertirla. Y la cuenta
es sobre lo que se emitió en el OS: lo facturado antes suma recién cuando esas
facturas se carguen, así que mientras dure la migración el número es un piso.
La pantalla lo dice.

## El seguimiento se prende solo

Marcar que la persona entró a trabajar y desde cuándo mueve la evaluación de
Entregado a Seguimiento (`lib/psicotecnicos-supabase.ts`), igual que administrar
el último test la mueve a Por analizar. Antes había que acordarse de prenderlo
desde un botón que vivía en la tabla de Entregados, y sin eso quedaba el reloj
de los noventa días puesto y la etapa sin mover: la columna decía "sin seguir",
el aviso de vencidos no la contaba y el cliente no veía "en seguimiento".

Y al revés: si se corrige que no entró, o se borra la fecha, vuelve a Entregado.
Un seguimiento sin reloj no vence nunca y quedaría en la lista para siempre.

**Un componente que copia una prop a estado tiene que volver a leerla.** El
desplegable de etapa de la ficha seguía mostrando la anterior después de que la
etapa cambiara sola, porque `router.refresh()` vuelve a dibujar del servidor
pero no reinicia el estado de un componente de cliente.

## El cobro se ve del lado del cliente

El portal muestra una columna de facturación por candidato: pagado, impago o
sin facturar. **Se publica solo donde el dato es cierto**, que hoy son las
empresas ya migradas: ahí el estado sale de las facturas emitidas en el OS
(`factura_items` cruzado con `facturas.cobrada_at`), y no de las dos tildes que
vinieron de Airtable. Para las empresas que siguen en Airtable la columna no
aparece: las tildes están sin cargar y publicarlas le diría "sin facturar" a un
informe ya cobrado.

**La factura manda sobre la tilde vieja**, y las anuladas no cuentan: una
factura anulada es una que no existió, y dejarla contando le diría al cliente
que ya se le facturó algo que hay que volver a facturarle.

**Antes de la entrevista no se dice nada.** La cola de facturación arranca
cuando la entrevista se tomó, así que en un candidato que recién entró la
columna va vacía: "sin facturar" ahí se lee como algo pendiente y no lo es.

## Los números de la barra los calcula cualquier pantalla

`cuentasDeLaBarra()` en `app/os/psicotecnicos/datos.ts`. Cada pantalla armaba
los suyos y pasaba solo el de su sección, así que entrar a una ficha o a
Facturación apagaba todos los demás: la barra dejaba de decir cuánto hay en cada
sección y lo decía nada más que en la que uno ya está mirando.

**Toda pantalla del OS la llama, Inicio incluida.** Es la que más se mira y era
de las que apagaban los números (27/8/2026): se veía el de Cotizaciones, que
ella misma calculaba, y ninguno del pipeline. La que además tiene un número
propio lo suma encima (`{{ ...cuentas, '/os/clientes': clientes.length }}`).
Al sumar una pantalla nueva, hay que pasarle `cuentas`.

Dicen cuántas se van a ver al entrar, no cuántas existen: respetan el filtro por
cliente y el alcance de quien mira. Un número que no coincide con la pantalla no
sirve para nada.

## Los pedidos viven adentro de su cliente

Dejaron de ser una sección el 25/8/2026. Una búsqueda no existe sin quien la
pidió, y en dos pantallas había que cruzar de memoria qué pedido era de quién:
la lista de pedidos gastaba media tabla en repetir el nombre del cliente y la de
clientes no decía si el cliente tenía trabajo abierto.

Clientes es una grilla de fichas con lo que se busca al entrar (cuántas
búsquedas abiertas, cuánta gente adentro), y entrar a una es entrar a sus
búsquedas. Los datos de facturación están en su ficha, que es el día que se los
necesita. `/os/pedidos` redirige, y la ficha de un pedido sigue en
`/os/pedidos/<id>`, con el botón de volver apuntando a su cliente.

**Los clientes están activos o inactivos**, y los inactivos van en su propio
bloque, abajo. Uno inactivo es uno con el que no se está trabajando: sigue
entero, con sus pedidos y sus informes, y deja de estar entre los de todos los
días. La lectura los trae a los dos (`empresas.activa`): un cliente que no
aparece en ningún lado no se puede volver a activar, que es lo que pasaba antes,
cuando la consulta filtraba por activa y los inactivos desaparecían de la
pantalla. Los que siguen en Airtable no tienen dónde marcarlo y se listan como
activos hasta que se migren.

**Activo son dos cosas a la vez y las dos tienen que darse**: la marca de la
base, que es la decisión de alguien, y que haya trabajo **en curso**, o sea un
pedido abierto o una cotización que salió y todavía no se perdió. La marca nace
en verdadero y nadie la toca, así que sola decía que estaba activo un cliente al
que nunca se le hizo nada.

Lo que ya se entregó y lo que se perdió son historia: un cliente cuyo único
pedido se cerró hace tres meses no es un cliente activo. Y un lead sin mandar
tampoco cuenta, que es una idea y no trabajo con ese cliente. Por eso a uno sin
nada en curso la ficha no le ofrece el botón de activar: lo que lo activa es que
entre trabajo.

**Un pedido se cierra solo cuando se entregaron todos sus informes**
(`lib/pedido-completo.ts`), que es lo que significa que la búsqueda terminó, y
se reabre solo si vuelve a haber trabajo: se le suma un candidato o una
evaluación entregada vuelve atrás. Un pedido cerrado no admite candidatos
nuevos, así que dejarlo cerrado con trabajo adentro esconde ese trabajo.

**Cancelado no se toca.** Es una decisión y no un estado que se deduzca del
trabajo: que se entregue un informe no revive un pedido que alguien canceló.

El botón de reabrir está para lo que el cierre automático no puede saber: el
cliente pide sumar a alguien a una búsqueda que ya se había dado por terminada.

## Cerrar no es borrar

Un pedido y un cliente se **cierran** cuando terminaron: siguen enteros y dejan
de ofrecerse al cargar candidatos. Se **borran** solo si nunca debieron existir,
y únicamente cuando no tienen nada colgando: un pedido con evaluaciones dejaría
personas reales sin saber a qué búsqueda entraron, que es lo único que explica
qué se les tomó y por qué.

Las rutas lo hacen cumplir del lado del servidor (`app/api/os/pedidos`,
`app/api/os/clientes`, ambas con su `DELETE`) y la pantalla ni siquiera ofrece
el botón cuando sabe que va a ser rechazado: en su lugar dice qué hacer.

## El CV se lee una sola vez, para los dos lados

`lib/cv-lectura.ts`. De las dos primeras páginas del PDF salen el nombre, el
correo y el teléfono.

**El PDF no viene en líneas: viene en trozos**, y pdfjs los corta donde cambia
la tipografía. Un nombre puesto arriba con una fuente por palabra llega como
"Marisol", "Rodríguez", "Graglia", y un mail con el dominio en otro color como
"marisolrz.1111" y "@gmail.com". Por eso los trozos se juntan por su altura en
la página (`transform[5]`) antes de buscar nada, y la arroba se pega aparte.
Salteárselo hacía que el lector no encontrara nada en un CV perfectamente
legible.

Después, cada dato tiene su trampa:

- **El nombre puede venir en dos renglones** (el nombre grande arriba, el
  apellido debajo), así que una línea de una sola palabra se prueba junto con
  la que sigue. Solo de una: con dos ya es un nombre entero, y unirla al renglón
  de abajo se llevaría puesto el cargo.
- **El primer número no es el teléfono.** El de una referencia laboral
  ("Referencia: (03476) 15645765") se leía como el suyo. Se prefiere el que está
  rotulado tel/cel/whatsapp, se descarta el que sigue a una referencia o a un
  documento, y se exige un número entero de ocho a trece dígitos, porque el
  patrón viejo se conformaba con siete y lo cortaba a la mitad.

**No hay dos CV iguales**, así que esto acierta seguido y no siempre: cuando un
dato no sale, la tarjeta lo dice ("Del CV no salió el correo") en vez de dejar
el campo vacío sin explicación.

**Es un motor de reglas y se queda así**: sin modelo, sin llamadas a nadie y sin
tokens, como el lector del Benziger. Cada CV raro que aparece se arregla con una
regla, no con una interpretación.

**Y como el del Benziger, se corre contra los que ya andaban antes de tocarlo:**

    node scripts/probar-cv.mjs ~/Documents/camposhr-privado/cv-prueba

Muestra qué sacó de cada PDF y qué faltó. Sin eso, arreglar un CV rompe otro sin
que nadie se entere. **Los CV de prueba no van al repositorio**: son datos de
personas y esto es público, así que viven en `~/Documents/camposhr-privado`, y
al que se arregla se lo suma ahí. Un dato que el CV no trae no es un error del
lector: hay que abrir el PDF y ver si está adentro antes de tocar una regla.

Lo usan las dos puertas que cargan candidatos: el cliente desde su portal
(`app/api/portal/cv`, que valida el token) y la evaluadora desde el tablero de
Entrevistas (`app/api/os/cv`, que valida la sesión del OS). El motor es uno
solo: el trabajo es el mismo y dos copias se habrían separado en la primera
corrección.

**Se lee en el servidor**, como el lector del Benziger: en el navegador habría
que servir el worker de pdfjs y bajar un megabyte por visita.

**No guarda nada.** Lee, devuelve y suelta; el archivo se sube con el alta.

**Acierta casi siempre, no siempre**, así que lo que devuelve va a campos que se
pueden corregir y solo llena los que están vacíos: lo que alguien escribió no se
pisa. Un CV ilegible vuelve vacío y no interrumpe nada, porque no puede dejar a
nadie sin poder cargar a esa persona.

**Y el campo del CV va a la vista, no detrás de "más datos"**: escondido nadie
lo usa, y entonces el lector no ahorra nada. Es una caja con borde punteado que
se toca para elegir el archivo o recibe el que se le suelte encima; las dos
formas terminan en el mismo `<input file>`, que es el que viaja con el alta, así
que el archivo arrastrado se mete ahí con un `DataTransfer` en vez de quedar
solo leído.

## Los datos de personas van a Supabase, no al repositorio

Un repositorio de git no sirve para guardar una evaluación psicológica: no
tiene borrado real, quien clona se lleva la base entera, y no queda constancia
de quién leyó qué. Desarrollado en `CAMPOS OS/SPECS-arquitectura.md`.

## Dónde se lee todo lo demás

`CAMPOS OS/LEEME.md` abre las especificaciones del sistema.
