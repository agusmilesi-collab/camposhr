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
  da exactamente eso, así que sumar una columna obliga a recortar otra.
- **Una fila es un renglón.** Lo que no entra se recorta con puntos
  suspensivos. El pedido es la única excepción, con dos: empresa arriba, puesto
  abajo.

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

**Las láminas van a `public/raven/laminas/`, numeradas de 1 a 36.** Este
repositorio es público, y `public/` se entrega a cualquiera que sepa la
dirección. Las láminas del APM son material con derechos y difundirlas invalida
el test para quien las haya visto: antes de subir los escaneos hay que decidir
si el repositorio se cierra o si las láminas se sirven desde Storage privado con
URL firmada, como el CV.

## Las etapas y las secciones no son lo mismo

`ETAPAS` son los estados del pipeline, los que viven en la base. `SECCIONES`
(en `lib/psicotecnicos-tipos.ts`) son las entradas de la barra lateral, y una
sección puede juntar varias etapas: **Entrevistas** trae "Por citar" y "Por
entrevistar" juntas.

Agrupar en la navegación no cambia el pipeline. Al sumar una sección hay que
tocar `SECCIONES`, las columnas de `Tabla.tsx` y las celdas de esa sección.

## Los datos de personas van a Supabase, no al repositorio

Un repositorio de git no sirve para guardar una evaluación psicológica: no
tiene borrado real, quien clona se lleva la base entera, y no queda constancia
de quién leyó qué. Desarrollado en `CAMPOS OS/SPECS-arquitectura.md`.

## Dónde se lee todo lo demás

`CAMPOS OS/LEEME.md` abre las especificaciones del sistema.
