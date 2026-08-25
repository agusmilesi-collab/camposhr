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
`/por-citar`, `/por-entrevistar`, `/por-analizar` y `/seguimiento` redirigen a
la sección que las absorbió: la ficha vuelve por esas direcciones cuando se
abrió desde esa etapa, y sin ellas el botón de volver da 404.

## Las etapas y las secciones no son lo mismo

`ETAPAS` son los estados del pipeline, los que viven en la base. `SECCIONES`
(en `lib/psicotecnicos-tipos.ts`) son las entradas de la barra lateral, y una
sección puede juntar varias etapas: **Entrevistas** trae "Por citar", "Por
entrevistar" y "Por analizar" juntas, una por columna de su tablero.

Agrupar en la navegación no cambia el pipeline: las seis etapas siguen enteras
en la base. Hoy son tres secciones, con dos, tres y dos etapas cada una.

**Tablero o tabla según qué se hace ahí.** Tablero donde el trabajo es mover
una ficha de columna: Sin asignar (`Reparto.tsx`) y Entrevistas
(`Entrevistas.tsx`), y en los dos la etapa se cambia arrastrando. Tabla donde el
trabajo terminó y lo que se hace es consultar: Entregados (`Entregados.tsx`),
que además trae el seguimiento como una columna. `Tabla.tsx`, que servía a todas
las secciones a la vez, se borró el 24/8/2026; lo que compartía quedó en
`piezas.tsx`.

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

## Los datos de personas van a Supabase, no al repositorio

Un repositorio de git no sirve para guardar una evaluación psicológica: no
tiene borrado real, quien clona se lleva la base entera, y no queda constancia
de quién leyó qué. Desarrollado en `CAMPOS OS/SPECS-arquitectura.md`.

## Dónde se lee todo lo demás

`CAMPOS OS/LEEME.md` abre las especificaciones del sistema.
