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
