# Facturar psicotécnicos desde el OS, con los web services de ARCA

Informe de factibilidad. Investigación sobre `camposhr-site` en modo lectura, sin
tocar nada del repositorio.

**Estado al 21/08/2026: investigado, nada construido.** No hay una línea de
código de esto en el repositorio, ni certificados pedidos, ni tablas creadas.
Por dónde se empieza está en la sección 7, y la primera etapa no es ARCA: son
las cuentas, porque sin ellas las dos evaluadoras no quedan separadas de verdad.
Lo que hace falta decidir antes de construir está en la sección 8.

---

## 1. Conclusión

Se puede, y sale cero pesos. Los web services de ARCA (WSAA para autenticar,
WSFEv1 para pedir el CAE) son gratuitos y públicos, y admiten tantos CUIT
emisores como certificados se den de alta. Lo que cobra Afip SDK es el trabajo
de firmar el pedido y hablar SOAP, que son unas trescientas líneas de código en
el mismo estilo con el que el OS ya habla con Supabase y Airtable: `fetch`
directo, sin SDK (`lib/supabase.ts:1-7`, "Sin SDK: la API REST (PostgREST) y la
de Storage se resuelven con fetch").

Con las dos evaluadoras monotributistas el caso fiscal es el más simple que hay:
**siempre factura C**, sin IVA que discriminar y sin decidir la letra contra la
condición del receptor.

Lo caro no es la conexión con ARCA. Son tres cosas del OS que hoy no están: que
cada una vea y emita solo lo suyo de verdad, la orden de compra donde el cliente
la exige, y el comprobante armado para mandar.

### Lo que quedó definido

| Definición | Consecuencia |
| --- | --- |
| Las dos evaluadoras son monotributistas | Siempre comprobante C (tipo 11), `ImpIVA = 0`, sin array de IVA. El precio cargado es el final, no un neto |
| Cada una gestiona y factura lo suyo, sin ver lo de la otra | El emisor sale de `evaluaciones.evaluadora_id`, y hace falta autenticación real antes de producción |
| Va a haber envío de correo | El comprobante tiene que quedar como archivo, no solo como número |
| Hay clientes que no aceptan factura sin orden de compra | La OC es un dato del sistema y una condición para emitir |
| El Benziger se pesifica al dólar tarjeta del día de facturación | La cotización se congela en la factura, y sin cotización no se emite |

---

## 2. Qué hay hoy en el OS

### El cliente ya tiene los campos fiscales

`supabase/empresas-datos.sql:11-15` agregó a `public.empresas` lo que hace falta
del receptor:

    razon_social, cuit, condicion_iva, direccion_fiscal, email_facturacion

y el encabezado del archivo lo dice: "Los datos de un cliente que hacían falta
para facturarle y para llamarlo". El correo de facturación ya está como campo, o
sea que el envío tiene a dónde ir.

Dos límites: la condición de IVA es texto elegido de una lista de cuatro
(`lib/clientes-tipos.ts:2-7`) y no el identificador que pide ARCA; y la mitad de
los clientes todavía vive en Airtable sin migrar (`lib/clientes.ts:70-118`), sin
CUIT de este lado.

### El precio ya está resuelto, y bien

`supabase/precios-de-baterias.sql` guarda la historia y la regla es la correcta
para facturar: el precio de una evaluación es el que regía el día que entró,
resuelto en `lib/ficha.ts:262-273`. Una factura emitida hoy por una evaluación
de marzo toma el precio de marzo.

Con las dos monotributistas, ese número es el importe final del comprobante. No
hay neto ni IVA que separar.

El adicional Benziger es otra cosa: está en dólares (`lib/benziger.ts:16`,
`BENZIGER_USD = 40`) y se pesifica con el dólar tarjeta de dolarapi
(`lib/baterias-precios.ts:79-96`). Al facturar se toma la cotización del día, se
congela en la factura y se guarda con su fecha.

### El cobro existe como dos tildes y un número escrito a mano

`supabase/psicotecnicos.sql:160-161` tiene `facturado` y `pagado`, con el
comentario "Cobro: dos tildes, sin importe ni número de factura". El número
llegó después (`supabase/seguimiento-y-factura.sql:30`) y hoy lo tipea una
persona: `app/os/psicotecnicos/ficha/[id]/Factura.tsx:63-72` es un campo de
texto.

El lugar del botón ya está dibujado. Lo que hoy es un campo pasa a ser el
resultado de una llamada.

### Quién emite: no está en ningún lado

`public.evaluadoras` (`supabase/psicotecnicos.sql:38-44`) tiene nombre y activa,
nada fiscal. Los dos CUIT no existen como dato. La semilla nombra a las dos:
Lorena Campos y Lucila Campos (`supabase/semilla-distribuidora-andina.sql:20`).

### El alcance por persona existe a medias

`supabase/equipo.sql` ya tiene la regla escrita: `alcance` en `'todo'` o
`'propio'`, y `evaluadora_id` para saber contra qué evaluaciones se compara. Eso
es exactamente lo que hace falta para que Lore no vea lo de Luli.

Lo que falta es que sea un permiso y no una preferencia. Hoy la identidad se
elige de un selector y viaja en una cookie (`lib/identidad.ts:9-12`: "el día que
haya cuentas... lo que hoy es una preferencia pasa a ser un permiso"), y al OS
se entra con una sola clave compartida (`middleware.ts:203-209`).

### Órdenes de compra: no existen en el modelo

Ni en `empresas` ni en `pedidos` hay nada de orden de compra. Es un dato nuevo.

### Correo: no hay nada conectado

No hay ningún proveedor de envío en el proyecto. Lo único son enlaces `mailto:`
en la ficha. El campo `email_facturacion` está, el envío no.

---

## 3. Qué cuesta plata y qué no

| Pieza | Costo |
| --- | --- |
| Certificado digital de ARCA (uno por CUIT) | Gratis |
| WSAA y WSFEv1 | Gratis |
| Alta del punto de venta para web services | Gratis |
| Ambiente de homologación (WSASS) | Gratis |
| Consulta de constancia de inscripción (padrón) | Gratis |
| Afip SDK | Pago por CUIT a partir del segundo |
| Proveedor de correo | Aparte, y ya está decidido incorporarlo |
| Desarrollo propio | Tiempo, una vez |

---

## 4. Los dos CUIT

Con cada una gestionando lo suyo, el camino es uno solo: **un certificado por
CUIT**. Cada evaluadora entra con su clave fiscal, genera su certificado en
"Administración de Certificados Digitales" y autoriza el servicio de facturación
electrónica. Nadie depende del trámite de la otra, y si una deja de facturar se
apaga sola.

El otro camino (un certificado que representa a las dos por delegación) existe y
también es gratis, pero mezcla lo que acá se quiere separado.

Cada CUIT tiene su punto de venta y su numeración, independientes.

---

## 5. Cómo se integra

### 5.1 Trámites, antes de escribir código

1. Clave fiscal nivel 3 de cada una.
2. Homologación: entrar a WSASS, generar el pedido de certificado (CSR),
   subirlo, bajar el certificado de prueba y autorizarle el servicio `wsfe`.
3. Producción: mismo circuito en "Administración de Certificados Digitales" y
   "Administrador de Relaciones". El certificado vence a los dos años.
4. Alta de un punto de venta del tipo web services por cada CUIT, distinto del
   que usan en Comprobantes en Línea. Si se comparte, la numeración se pisa.

El CSR se genera con openssl, en la computadora, y la clave privada no sale de
ahí:

    openssl genrsa -out privada.key 2048
    openssl req -new -key privada.key -subj "/C=AR/O=<razón social>/CN=<alias>/serialNumber=CUIT <cuit>" -out pedido.csr

### 5.2 Datos nuevos en Supabase

    -- Quién emite. Una fila por evaluadora que factura.
    create table public.emisores (
      id             uuid primary key default gen_random_uuid(),
      evaluadora_id  uuid not null unique references public.evaluadoras (id),
      cuit           text not null unique,
      razon_social   text not null,
      condicion_iva  text not null default 'Monotributo',
      categoria      text,                 -- para avisar cuando se acerca al tope
      punto_venta    integer not null,     -- el habilitado para web services
      domicilio      text,
      inicio_actividades date,
      ambiente       text not null default 'homologacion'
                     check (ambiente in ('homologacion','produccion')),
      cert_vence_el  date,
      activo         boolean not null default true
    );

    -- El ticket de acceso del WSAA, que dura 12 horas y se comparte.
    create table public.arca_tickets (
      cuit      text not null,
      servicio  text not null default 'wsfe',
      token     text not null,
      sign      text not null,
      expira_at timestamptz not null,
      primary key (cuit, servicio)
    );

    -- La factura, con lo pedido y lo que ARCA contestó.
    create table public.facturas (
      id            uuid primary key default gen_random_uuid(),
      emisor_id     uuid not null references public.emisores (id),
      empresa_id    uuid not null references public.empresas (id),
      cbte_tipo     integer not null default 11,   -- C, siempre
      punto_venta   integer not null,
      numero        integer,                       -- reservado antes de llamar
      fecha         date not null,
      doc_tipo      integer not null default 80,   -- 80 = CUIT
      doc_nro       text not null,
      condicion_iva_receptor integer not null,     -- el id de ARCA, no el texto
      imp_total     numeric(12,2) not null,        -- en C, igual al neto
      moneda        text not null default 'PES',

      -- Lo que hace falta para explicar el número y para que el cliente lo pague.
      orden_compra  text,
      dolar_tarjeta numeric(12,2),                 -- el usado para el Benziger
      dolar_fecha   timestamptz,

      cae           text,
      cae_vence_el  date,
      estado        text not null default 'borrador'
                    check (estado in ('borrador','emitida','rechazada','anulada')),
      pdf_path      text,
      enviada_at    timestamptz,
      enviada_a     text[],
      solicitud     jsonb,   -- lo que se mandó, tal cual
      respuesta     jsonb,   -- Obs y Errors de ARCA, tal cual
      quien         text,
      created_at    timestamptz not null default now(),
      unique (emisor_id, punto_venta, cbte_tipo, numero)
    );

    -- Qué evaluaciones entraron en esa factura.
    create table public.factura_items (
      id             uuid primary key default gen_random_uuid(),
      factura_id     uuid not null references public.facturas (id) on delete cascade,
      evaluacion_id  uuid references public.evaluaciones (id),
      descripcion    text not null,
      cantidad       numeric(12,2) not null default 1,
      precio_unitario numeric(12,2) not null,
      importe        numeric(12,2) not null
    );

    -- Una evaluación no se factura dos veces.
    create unique index factura_items_evaluacion_idx
      on public.factura_items (evaluacion_id) where evaluacion_id is not null;

    -- Órdenes de compra.
    alter table public.empresas add column if not exists exige_orden_compra boolean not null default false;
    alter table public.empresas add column if not exists emails_facturacion text[];
    alter table public.pedidos  add column if not exists orden_compra text;

### 5.3 Código

    lib/arca/tra.ts          arma el XML del pedido de acceso, con margen de reloj
    lib/arca/firma.ts        lo firma en CMS con node-forge y devuelve base64
    lib/arca/wsaa.ts         loginCms, con caché en arca_tickets
    lib/arca/wsfe.ts         FEDummy, FECompUltimoAutorizado, FECAESolicitar,
                             FECompConsultar, FEParamGetCondicionIvaReceptor
    lib/arca/comprobante.ts  de qué evaluaciones sale qué comprobante
    lib/facturas.ts          lectura para las pantallas, filtrada por evaluadora
    app/api/os/facturar/route.ts   emite una factura
    app/os/facturas/               "Por facturar" y "Emitidas"

Los endpoints:

    homologación  https://wsaahomo.afip.gov.ar/ws/services/LoginCms
                  https://wswhomo.afip.gov.ar/wsfev1/service.asmx
    producción    https://wsaa.afip.gov.ar/ws/services/LoginCms
                  https://servicios1.afip.gov.ar/wsfev1/service.asmx

El flujo de una emisión:

1. Se juntan las evaluaciones a facturar y se resuelve el emisor por la
   evaluadora.
2. Se pide el ticket de acceso: si hay uno vigente en `arca_tickets`, se usa.
3. `FECompUltimoAutorizado` da el último número; se reserva el siguiente
   insertando la factura en `borrador` con la clave única de arriba.
4. `FECAESolicitar` con el detalle.
5. Con `Resultado = A` se guardan CAE y vencimiento y la factura pasa a
   `emitida`. Con `R` se guardan los errores, queda `rechazada` y el número se
   libera.
6. Se genera el PDF, se marcan las evaluaciones como facturadas y se anota el
   acceso.

### 5.4 Cómo queda el comprobante C

Con las dos monotributistas, el armado es siempre el mismo:

    CbteTipo   = 11        (Factura C)
    Concepto   = 2         (servicios: obliga a informar período y vencimiento de pago)
    ImpTotal   = el importe
    ImpNeto    = el mismo importe
    ImpIVA     = 0
    ImpOpEx    = 0
    ImpTrib    = 0
    Iva        = no se informa
    MonId      = PES, MonCotiz = 1

Lo único que sigue dependiendo del cliente es `CondicionIVAReceptorId`, que es
obligatorio desde el 1/7/2025 y sin el cual el pedido se rechaza. Hay que mapear
los cuatro textos de `lib/clientes-tipos.ts` al identificador de ARCA
(Responsable Inscripto = 1, Exento = 4, Consumidor Final = 5, Monotributo = 6) y
confirmar la lista con `FEParamGetCondicionIvaReceptor`.

**Un control que conviene sumar de una:** el monotributo tiene tope anual de
facturación por categoría. Con todas las facturas en la base, el OS puede
mostrarle a cada una cuánto lleva emitido en los últimos doce meses y avisar
cuando se acerca. Es una consulta, y evita el problema que se descubre tarde.

### 5.5 Cada una ve y factura lo suyo

Esto pasa de ser una mejora de seguridad a ser un requisito del negocio, y es la
pieza que hay que hacer sí o sí antes de emitir en producción.

**Lo que ya está.** `supabase/equipo.sql` tiene `alcance` (`'todo'` o
`'propio'`) y `evaluadora_id`. Las pantallas ya preguntan quién soy y filtran
por eso.

**Lo que falta.** Hoy la identidad se elige de un selector y viaja en una
cookie, y al OS se entra con una clave compartida. Con eso, "Lore no ve lo de
Luli" es una cortesía de la interfaz: cambiar el selector alcanza para ver, y
para emitir, a nombre de la otra. Con dos CUIT reales y comprobantes fiscales de
por medio eso no se sostiene.

**Qué hace falta.** Cuentas de verdad, una por persona. `lib/identidad.ts` está
escrito para ese cambio: solo `quienSoy` pasa a leer la sesión en vez de la
cookie, y el resto queda igual. Sobre eso:

- El listado "Por facturar" trae solo las evaluaciones de la evaluadora de quien
  entró.
- La ruta de emisión vuelve a comprobar del lado del servidor que el emisor sea
  el de quien pide. Un filtro que solo vive en la pantalla no es un permiso.
- Cada certificado se usa únicamente para su CUIT.
- Queda registrado quién emitió qué (`lib/accesos.ts` ya existe para eso).

**Una decisión pendiente:** vos tenés alcance `'todo'`. Ver las dos colas es
razonable. Emitir a nombre de las dos es otra cosa, y hay que decidirlo
explícitamente.

### 5.6 Facturar en lote

Sí se puede, y de dos maneras.

**Lo que admite el web service.** `FECAESolicitar` tiene modo en lote: varios
comprobantes en una sola llamada, cada uno con su número y su receptor, y un CAE
por comprobante. El tope lo informa `FECompTotXRequest` (hoy 350 en
homologación). La restricción está en la cabecera: el tipo de comprobante y el
punto de venta van una sola vez, así que todo el lote comparte emisor, tipo y
punto de venta.

Acá eso juega a favor. Como cada una factura lo suyo y todo es C, siete
evaluaciones de cuatro clientes son cuatro comprobantes del mismo emisor, mismo
tipo y mismo punto de venta: entran en una sola llamada.

La respuesta puede volver `A` (todo aprobado), `R` (todo rechazado) o `P`
(parcial), y hay que leer el resultado de cada comprobante por separado.

**Lo que conviene igual.** Emitir de a una, en serie, aunque el botón sea uno
solo y diga "Facturar las 4":

- El resultado parcial hay que desarmarlo comprobante por comprobante de todos
  modos, así que el lote no ahorra el trabajo difícil.
- De a una, cada factura tiene su número reservado, su reintento y su fila en
  pantalla. Si se corta en la tercera, se sabe cuál quedó a medias y se resuelve
  con `FECompConsultar`.
- La pantalla va marcando fila por fila mientras avanza, como el OS ya hace en
  todos lados.
- Iterando desde el navegador cada llamada es corta y no hay riesgo de que la
  función se pase del tiempo máximo.

**Regla que no se puede romper:** dentro de un mismo emisor las facturas se
emiten en serie, nunca en paralelo, porque la numeración es una sola cola por
punto de venta. Como cada una factura por separado, esto sale solo.

**La cotización se lee una vez por tanda.** Si en las cuatro facturas hay
Benziger, las cuatro usan el mismo valor de dólar tarjeta, leído al empezar y
guardado en cada factura con su fecha. Distinto sería que la primera y la cuarta
salieran con cotizaciones distintas por una diferencia de segundos.

**Si dolarapi no contesta, no se emite.** Hoy la pantalla de precios muestra el
importe sin pesificar cuando la API falla (`lib/baterias-precios.ts:79-96`), que
está bien para mirar y no para facturar. En emisión: se corta con el motivo, o
se pide el valor a mano y queda registrado que se cargó a mano.

### 5.7 La pantalla "Por facturar"

Es la tabla que hoy no existe y que la revisión previa necesita:

- Trae las evaluaciones entregadas y sin facturar **de quien entró**, agrupadas
  por cliente. Cada grupo es un borrador de factura.
- Cada borrador muestra qué evaluaciones entran (candidato y puesto), el
  concepto, el período, la orden de compra y el importe desglosado: precio de la
  batería a la fecha del pedido más el Benziger pesificado al dólar de hoy.
- Se puede tocar antes de emitir: qué evaluaciones entran, el concepto, la fecha
  y la orden de compra.
- **Las validaciones corren antes, no en ARCA.** CUIT presente y con dígito
  verificador válido, condición de IVA mapeada, precio cargado, cotización
  disponible, y orden de compra donde el cliente la exige. El grupo que no pasa
  se muestra con el motivo y no se puede tildar. Enterarse por un rechazo de
  ARCA de que a un cliente le falta el CUIT es enterarse tarde.
- Una evaluación entra en una sola factura, garantizado por el índice único
  sobre `factura_items.evaluacion_id`. Un doble clic no duplica nada.

### 5.8 Órdenes de compra

Cofco y los que trabajan igual no pagan una factura sin su número de orden de
compra, y muchas veces la rechazan al recibirla. Es una condición de emisión,
no un comentario.

**Cómo entra al modelo.** `empresas.exige_orden_compra` marca al cliente que la
pide. `pedidos.orden_compra` guarda el número, porque la OC se emite por la
búsqueda y no por candidato: siete evaluaciones de un mismo pedido van con la
misma OC. La factura guarda copia del número con el que salió.

**Qué hace el sistema con eso.** Si el cliente la exige y el pedido no tiene
número cargado, el borrador se muestra bloqueado con el motivo y no se puede
emitir. Es la misma validación previa que el CUIT.

**Dónde aparece el número.** Esto importa: WSFEv1 no tiene campo para orden de
compra. El comprobante que se autoriza no lleva detalle de items, así que el CAE
sale sin ese dato. **El número de OC va en la representación impresa**, o sea en
el PDF que arma el OS. Por eso el PDF propio no es un lujo acá: es lo que hace
cobrable la factura frente a esos clientes.

Si alguna OC tiene monto tope y hay que controlar el saldo (facturar contra ella
en varias veces), eso pide una tabla propia de órdenes con su importe y lo
consumido. Mientras sea un número que se transcribe, con el campo alcanza.

Aparte queda lo que no se automatiza: los clientes grandes suelen tener portal
de proveedores donde hay que subir la factura a mano. El OS deja el PDF listo,
la subida es de ellos.

### 5.9 El PDF, y el envío al cliente

Cómo se vería, con datos de la base de prueba y un CAE inventado:
`SPECS-facturacion-muestra.html`, al lado de este archivo. Abajo de la hoja
están los dos JSON, el que sale y el que vuelve, para ver de un vistazo qué
autoriza ARCA y qué vive solo acá.

**ARCA no devuelve ningún PDF.** El web service devuelve número, CAE y
vencimiento del CAE. La representación impresa la arma quien emite. Comprobantes
en Línea genera un PDF, pero es el circuito manual y no una interfaz de
programación.

Así que el comprobante se genera acá y se guarda acá:

- **El molde**, como el del informe: uno solo. Lleva los datos de la emisora y
  del cliente con sus condiciones de IVA, la letra C, número y fecha, el
  detalle (candidato y puesto por línea), el importe, la orden de compra, el CAE
  con su vencimiento y el código QR de la RG 4892. `qrcode` ya está en
  `package.json`.
- **Dónde queda:** el bucket privado de Supabase, el mismo patrón del informe
  entregado. `lib/supabase.ts:331-395` ya tiene la subida y las direcciones
  firmadas. En `facturas` va `pdf_path`.
- **Cómo llega al cliente:** con el sistema de correo que vas a integrar, sale a
  `empresas.emails_facturacion` con el PDF adjunto, y la factura guarda cuándo se
  mandó y a quiénes (`enviada_at`, `enviada_a`). Conviene que sean varios
  destinatarios y no uno: en las empresas medianas la factura va a cuentas a
  pagar y en copia a quien pidió la búsqueda. Mientras el correo no esté, la
  descarga desde el OS y el portal del cliente ya alcanzan.
- Después de facturar las cuatro, quedan las cuatro descargables juntas.

**Cómo se genera el archivo.** Dos caminos, y hay que elegir:

1. `pdf-lib`, dibujando el comprobante. Liviano, sin binarios, anda en Vercel
   sin tocar nada, y deja el archivo guardado sin que nadie apriete nada. Es lo
   que hace falta para poder adjuntarlo a un correo automático.
2. La página del comprobante en HTML, impresa a PDF desde el navegador. Cero
   dependencias nuevas, pero alguien tiene que apretar imprimir, y eso no se
   puede adjuntar solo.

Con envío por correo en el plan, el primero es el que corresponde.

El respaldo formal del comprobante siempre está en ARCA, en Mis Comprobantes. El
PDF propio es para el cliente.

---

## 6. Riesgos, y qué hacer con cada uno

**Una factura emitida no se borra.** El CAE es definitivo; el error se corrige
con una nota de crédito (tipo 13 para los comprobantes C). El botón necesita una
confirmación con el detalle completo antes de llamar, y la nota de crédito
prevista desde el diseño.

**El control de acceso.** Detallado en 5.5. Es requisito, no mejora.

**Numeración y llamadas simultáneas.** La reserva del número con la restricción
única de `facturas` resuelve el empate: el segundo intento falla al insertar y
vuelve a pedir el último autorizado.

**Si ARCA tarda y se corta la llamada.** Nunca reintentar a ciegas: se consulta
con `FECompConsultar` el número reservado y se ve si quedó autorizado. Un
reintento ciego es un comprobante duplicado.

**El ticket de acceso dura 12 horas y no se puede pedir otro mientras haya uno
vigente.** ARCA devuelve `coe.alreadyAuthenticated`. En Vercel cada llamada
puede caer en una instancia distinta y sin memoria compartida, así que la tabla
`arca_tickets` es obligatoria y no una optimización. Son dos tickets, uno por
CUIT.

**El reloj.** El pedido de acceso lleva hora de generación y de expiración, y un
desfase lo invalida. Se genera con diez minutos para atrás y diez para adelante.

**La región.** `vercel.json` fija `gru1` (San Pablo). Los web services de ARCA se
alcanzan desde el exterior, pero conviene confirmarlo en homologación antes de
avanzar.

**Runtime.** `node-forge` necesita Node, no Edge. El proyecto ya está en Node por
`pdfjs-dist` (`next.config.mjs`).

**Los certificados vencen a los dos años.** `emisores.cert_vence_el` y un aviso
en Pendientes evita descubrirlo el día que hay que facturar.

**El tope del monotributo.** Con el acumulado de doce meses a la vista, deja de
ser una sorpresa.

**Los clientes de Airtable.** Los que no migraron no tienen CUIT de este lado. O
se migran antes, o el botón no aparece para ellos.

---

## 7. Plan por etapas

| Etapa | Qué | Sin lo cual no se sigue |
| --- | --- | --- |
| 1. Cuentas | Autenticación real, una cuenta por persona, sobre `equipo.alcance` que ya existe | Sin esto no hay separación entre las dos, y no se puede emitir en producción |
| 2. Trámites y datos | Certificados de homologación, puntos de venta, CUIT y condición de IVA de los clientes, marca de quién exige orden de compra | Nada del resto sirve |
| 3. Conexión | `lib/arca`, `FEDummy` y `FECompUltimoAutorizado` contra homologación | Confirma certificado, reloj, región y firma |
| 4. Emisión de prueba | Tablas, ruta y pantalla "Por facturar" con los borradores agrupados, emisión de a una, todo con Distribuidora Andina | La regla del repositorio: se prueba con la empresa inventada |
| 5. El comprobante | PDF con QR y orden de compra, guardado en el bucket, descargable | Sin esto hay CAE pero nada para mandar |
| 6. Producción | Certificados reales, primera factura real comparada contra Comprobantes en Línea | |
| 7. Envío | Correo a `emails_facturacion` con el PDF adjunto, y registro del envío | Depende del proveedor que integres |
| 8. Lo que sigue | Nota de crédito, pantalla de emitidas, acumulado del monotributo | |

Las etapas 3 y 4 son el grueso del código y no dependen de nada externo una vez
que existe el certificado. La 1 es la que conviene no postergar, porque toca
todas las pantallas y es más barata ahora que después.

---

## 8. Lo que queda por definir

1. **¿Vos podés emitir a nombre de las dos, o solo mirar?** Ver las dos colas es
   razonable; emitir con el certificado de otra persona es una decisión aparte.
2. **¿Una factura por cliente y tanda, o una por pedido?** Un cliente con dos
   búsquedas abiertas puede querer una factura por cada una, sobre todo si cada
   búsqueda tiene su propia orden de compra. Esto último probablemente lo decide.
3. **¿Las órdenes de compra tienen monto y saldo, o son solo un número que el
   cliente exige ver impreso?** Lo primero pide una tabla propia.
4. **¿Cuándo se factura?** Al entregar cada informe, al cerrar el pedido, o una
   tanda por quincena. Define si la pantalla se mira todos los días o los martes.
5. **¿El cliente ve su factura en el portal, además de recibirla por correo?**
   El portal ya existe y es el mismo enlace donde ve sus informes.

---

## 9. Fuentes

Del repositorio, en modo lectura:
`supabase/empresas-datos.sql:11-15`, `supabase/psicotecnicos.sql:38-44` y
`:96,160-161`, `supabase/seguimiento-y-factura.sql:30`,
`supabase/precios-de-baterias.sql`, `supabase/equipo.sql`,
`supabase/semilla-distribuidora-andina.sql:20`, `lib/ficha.ts:262-273`,
`lib/clientes-tipos.ts:2-7`, `lib/clientes.ts:70-118`, `lib/cobro.ts`,
`lib/benziger.ts:16`, `lib/baterias-precios.ts:79-96`, `lib/supabase.ts:1-7` y
`:331-395`, `lib/identidad.ts:9-12`, `lib/accesos.ts`, `middleware.ts:203-209`,
`app/os/psicotecnicos/ficha/[id]/Factura.tsx:63-72`, `next.config.mjs`,
`vercel.json`, `package.json`.

Oficiales de ARCA:
- Documentación de web services: https://www.afip.gob.ar/ws/
- WSAA: https://www.afip.gob.ar/ws/documentacion/wsaa.asp
- Certificados: https://www.afip.gob.ar/ws/documentacion/certificados.asp
- Facturación electrónica (manual del desarrollador WSFEv1):
  https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp
- Manual de WSASS (homologación): https://www.afip.gob.ar/ws/WSASS/WSASS_manual.pdf
- Generación de certificados de producción:
  https://www.afip.gob.ar/ws/wsaa/wsaa.obtenercertificado.pdf
- Manual del desarrollador con las validaciones de comprobantes C:
  https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1-COMPG.pdf

De referencia:
- Condición de IVA del receptor obligatoria (RG 5616) y error 10242:
  https://afipsdk.com/blog/factura-electronica-solucion-a-error-10242/
- Reutilización del ticket de acceso de 12 horas:
  https://groups.google.com/g/pyafipws/c/faq4C4nWmSM
- Modo en lote de FECAESolicitar:
  https://sites.google.com/site/facturaelectronicax/wsfev1/wsfev1/wsfev1-modo-en-lote
- node-forge, firma CMS/PKCS#7 en JavaScript: https://www.npmjs.com/package/node-forge
