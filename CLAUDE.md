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

## Las tablas del pipeline tienen anchos fijos, por campo

`ANCHO` en `app/os/psicotecnicos/Tabla.tsx` declara cuánto mide cada columna por
el **nombre del campo**, no por su posición: así "Candidato" mide lo mismo en
las cuatro secciones y pasar de una a otra no mueve nada de lugar.

Dos reglas al tocarlo:

- **Ninguna tabla pasa de 1200 px.** La más ancha ("Por citar", ocho columnas)
  da exactamente eso, así que sumar una columna obliga a recortar otra. Los
  anchos declarados viajan al `colgroup` en proporción y no en píxeles: cuando
  la ventana da los 1200, cada columna mide lo suyo; cuando no los da, se
  reparten lo que hay. **Nada de desplazamiento horizontal**, que esconde
  columnas enteras sin avisar.
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

Todo lo que sea un botón usa `os-boton`, con `os-boton-firme` para el principal.
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

Al sumar una etapa hay que sumar su sección, su entrada en la barra lateral
(`app/os/Shell.tsx`, que tiene su propia lista) y sus columnas en `Tabla.tsx`.

## Las etapas y las secciones no son lo mismo

`ETAPAS` son los estados del pipeline, los que viven en la base. `SECCIONES`
(en `lib/psicotecnicos-tipos.ts`) son las entradas de la barra lateral, y una
sección puede juntar varias etapas: **Entrevistas** trae "Por citar" y "Por
entrevistar" juntas.

Agrupar en la navegación no cambia el pipeline. Al sumar una sección hay que
tocar `SECCIONES`, las columnas de `Tabla.tsx` y las celdas de esa sección.

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
