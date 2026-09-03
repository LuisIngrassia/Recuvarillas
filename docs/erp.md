# El ERP

Sistema de gestión de Recuvarilla. Vive en el mismo proyecto que la landing,
colgado de `/erp`, y guarda todo en [Supabase](https://supabase.com).

El día a día:

| Pantalla         | Para qué                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| **Panel**        | Qué hay que entregar hoy, y cómo viene el mes de punta a punta.         |
| **Leads**        | Todo el que preguntó, por donde sea: a quién llamar y qué contestó.     |
| **Clientes**     | El padrón con la cuenta corriente de cada uno.                          |
| **Pedidos**      | Del presupuesto a la entrega, con la mercadería, el flete y los cobros. |
| **Stock**        | Existencias y movimientos: producción, ventas, ajustes y devoluciones.  |
| **Caja**         | Los cobros del período, con el total por medio de pago.                 |
| **Costos**       | Lo que sale: producción, pauta, muestras y lo que venga.                |
| **Rentabilidad** | El resultado del mes y cómo se reparte entre los socios.                |
| **Documentos**   | La lista de precios, el folleto y la ficha técnica, con el contacto de cada vendedor. |

Y lo que se toca de vez en cuando, bajo **Ajustes**:

| Pantalla        | Para qué                                                                |
| --------------- | ----------------------------------------------------------------------- |
| **Precios**     | La lista por cantidad, que es la misma que usa el simulador de la web.   |
| **Fletes**      | Los transportes, hasta dónde llega cada uno y a cuánto.                  |
| **Vendedores**  | Quién trae la venta, su comisión y lo que hay que liquidarle en el mes.  |

---

## Montarlo (una sola vez, unos 15 minutos)

### 1. Crear el proyecto en Supabase

Entrá a [supabase.com](https://supabase.com), creá una cuenta y hacé un
proyecto nuevo. Elegí la región más cercana (São Paulo) y guardá la contraseña
de la base que te pide: no se vuelve a mostrar.

El plan gratuito alcanza y sobra para esto.

### 2. Crear las tablas

En el panel del proyecto: **SQL Editor → New query**. Pegá todo el contenido de
[`supabase/schema.sql`](../supabase/schema.sql) y dale **Run**.

Eso crea las tablas, las vistas, los permisos y carga la lista de precios que
hoy está en el código. Se puede volver a correr sin miedo: no pisa nada de lo
que ya haya cargado.

Y hay que volver a correrlo cada vez que el archivo cambie —cuando se agrega una
pantalla nueva, por ejemplo—, porque es la única forma en que la base se entera.
Está escrito para eso: las tablas usan `if not exists`, las columnas que
llegaron después se agregan con `alter table`, las vistas se tiran abajo y se
rehacen, y las semillas sólo entran si la tabla está vacía.

### 3. Enchufar las claves

En **Project Settings → API** vas a encontrar dos datos: la **URL** del proyecto
y la clave **anon public**.

Copiá `.env.example` a `.env` y pegalos:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Ojo con la URL: el panel muestra dos parecidas, la **Project URL** y el
> *RESTful endpoint*, que es la misma con `/rest/v1/` pegado atrás. Va la
> primera, el dominio pelado y sin barra final. Con la otra, el login falla con
> «Invalid path specified in request URL» y la landing se queda con los precios
> del código, porque el `/rest/v1/` termina puesto dos veces.

Volvé a levantar `npm run dev` (Vite lee el `.env` al arrancar, no en caliente).

> La clave `anon` es pública: viaja en el código de la web y cualquiera puede
> verla. No es un descuido, es cómo funciona: lo que cuida los datos son las
> políticas del paso 2. La clave **`service_role` no va nunca acá**, ni en el
> `.env` ni en Vercel: esa sí saltea todos los permisos.

### 4. Crear los usuarios

En **Authentication → Users → Add user**, uno por cada persona que va a entrar.
Marcá **Auto Confirm User** para que no tenga que validar el mail.

No hay registro abierto ni recuperación de contraseña por diseño: las cuentas
las crea el administrador y las cambia desde el mismo panel. Es un equipo chico
y conocido; un formulario de alta abierto en internet sería una puerta que nadie
necesita.

### 5. Deployar

En Vercel, en **Settings → Environment Variables**, cargá las mismas dos
variables (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) y volvé a deployar.
Vite las mete en el bundle al compilar, así que un deploy hecho antes de
cargarlas no las va a tener.

El archivo [`vercel.json`](../vercel.json) ya está: hace que cualquier
dirección devuelva `index.html`, que es lo que necesita el router para que
entrar directo a `/erp/pedidos` o recargar ahí no dé 404. Vercel sirve primero
los archivos que existen, así que las imágenes y el JS no pasan por esa regla.

---

## Cómo se usa

### El circuito de una venta

```
Alguien cotiza en la web
        ↓
   Lead (nuevo)  ──── se lo llama ────→  contactado
        ↓
   "Hacer cliente"  →  Cliente + lead marcado como ganado
        ↓
   Nuevo pedido  →  presupuesto
        ↓ se carga la mercadería y se confirma
   confirmado  →  en producción  →  entregado
                                        ↓
                             el stock se descuenta solo
```

Los cobros se cargan desde el pedido, en cualquier momento del circuito, y bajan
el saldo de la cuenta corriente del cliente.

### Leads y de dónde vienen

Un lead es **cualquiera que preguntó**, no sólo el que usó el simulador. Los de
la web entran solos; el que escribe por Instagram, el que llama o el que te pasó
un conocido se cargan con **Nuevo lead**, eligiendo el canal.

Los leads cargados a mano no traen presupuesto, y está bien: el que pregunta un
precio por Instagram todavía no cotizó nada. Esos campos quedan vacíos y la
pantalla los muestra con un guión en vez de un cero, que se leería como si
hubiera pedido cero varillas.

El canal se cruza con la pauta en **Rentabilidad**: ahí se ve cuántos contactos
trajo cada uno, cuántos cerraron y cuánto facturaron, al lado de lo que se gastó
en publicidad ese mes. Sin eso la pauta es un gasto que baja la ganancia sin que
nada diga si sirvió.

Dos detalles del cálculo:

- **La venta se cuenta en el mes del contacto, no en el del pedido.** Se está
  midiendo la captación: al que preguntó en septiembre lo trajo la plata gastada
  en septiembre, aunque compre en noviembre.
- **A cada cliente se le atribuye un solo lead: el primero que lo trajo.** Si
  alguien preguntó tres veces antes de comprar, contar sus ventas en las tres
  las triplicaría. Un cliente cargado a mano, sin ningún lead detrás, no suma en
  ningún canal: es preferible a repartirlo por aproximación y creer que la
  cuenta cierra.

Sin sesión sólo se pueden dejar leads marcados como `web`, que es de donde
efectivamente viene el simulador. Si no, cualquiera con la clave pública podría
cargar contactos firmados como "referido" y la medición pasaría a ser un número
que se puede inventar desde afuera.

**Leads y clientes son dos tablas y siguen siéndolo**, a propósito. Un lead es
un hecho ("alguien preguntó por 500 varillas el 3 de septiembre") y un cliente
es una persona; la misma persona puede generarte cinco consultas en dos años. La
ficha del cliente ya muestra todas las suyas. Y hay una razón de seguridad:
`leads` acepta escritura anónima —la necesita el simulador— y `customers` no,
así que unificarlas pondría los CUIT y las direcciones en una tabla donde puede
escribir cualquiera con la clave pública.

Lo que sí faltaba, y ya está: cuando el que vuelve a preguntar **ya es cliente**,
"Hacer cliente" ofrece engancharlo a la ficha que existe en vez de crear una
nueva. Esa era la duplicación real.

### Presupuestos

El presupuesto no es un documento aparte: **es el pedido**, en su primer estado.
Se carga el cliente, la mercadería y el flete como cualquier pedido, y el botón
**Presupuesto** lo muestra con la marca, listo para exportar a PDF y mandar.

Eso reemplaza al formulario suelto que había en
[`presupuesto_recu_varilla.html`](presupuesto_recu_varilla.html). La diferencia
de fondo no es el lugar: ahí los datos se tipeaban de nuevo cada vez y el papel
era todo lo que quedaba. Acá el presupuesto ya está guardado contra su cliente,
con su número, y si el cliente compra se convierte en venta sin volver a cargar
nada. También admite varias líneas: aquel formulario tenía una sola varilla más
el agujereado, y un pedido de 600 comunes y 600 agujereadas no entraba.

Dos cosas se manejan desde esa pantalla:

- **El descuento** es un porcentaje sobre la mercadería, no sobre el flete: lo
  que se resigna es margen propio y el transporte cobra igual. Es plata de
  verdad, así que se guarda en el pedido y baja el total, la cuenta corriente,
  la comisión del vendedor y la ganancia del mes. Se puede escribir para ver
  cómo queda antes de comprometerlo; hasta que no se guarda, se imprime pero no
  afecta ningún total, y la pantalla lo avisa.
- **El IVA** es sólo una forma de mostrarlo. El sistema entero trabaja sin IVA
  —la lista impresa también— y eso no cambia: el 21% se agrega al papel para el
  cliente que lo pide, y no se guarda en ningún lado.

Las notas al pie se pueden retocar haciendo clic sobre ellas antes de exportar,
pero ese cambio vale para ese PDF y no queda guardado.

### Estados de un pedido

- **Presupuesto** — todavía no es una venta. No pesa en la cuenta corriente ni
  en las ventas del mes.
- **Confirmado** — el cliente lo cerró. Desde acá cuenta como venta **y la
  mercadería queda reservada**: sigue en el depósito, pero deja de estar
  disponible para venderle a otro.
- **En producción** — se está fabricando.
- **Entregado** — salió. En este momento, y sólo en este, se descuenta el stock.
- **Cancelado** — se cayó. Queda registrado pero no suma en ningún total.

Volver un pedido entregado a otro estado devuelve la mercadería al stock. Los
ítems no se pueden editar una vez entregado, justamente para que el descuento
que ya se hizo siga coincidiendo con lo que dice el pedido.

**Una seña cobrada contra un presupuesto entra en Caja pero no es una venta.**
Es la diferencia que más confunde: cobraste, la plata está, y el mes figura en
cero en Facturado y en Rentabilidad. Es correcto —el pedido todavía no se
cerró—, y ahora las tres pantallas lo dicen: el pedido avisa al registrar el
cobro, Caja marca esos cobros como *sin confirmar* y aclara cuánto del total
son, y Rentabilidad, cuando el mes está vacío, explica que puede ser por eso.

Para que cuente, el pedido tiene que pasar a **confirmado**.

### Precios y revendedores

Hay **dos listas**, no una con tramos de volumen:

- **Minorista** — la pública. Es la que cotiza el simulador de la web y la que
  paga cualquiera que no tenga acuerdo. Baja por cantidad, pero es la misma
  lista de punta a punta.
- **Mayorista** — la de los revendedores, que compran todos los meses. Arranca
  en 1.000 unidades y es notablemente más barata.

Lo que decide cuál se aplica es **quién compra, no cuánto compra**. Un
particular que un día lleva 2.000 varillas paga la minorista; un revendedor que
este mes lleva 300 paga la mayorista igual, porque lo que se le reconoce es que
vuelve. Si su pedido queda por debajo del primer escalón de su lista, se le
aplica ese primer escalón.

Un cliente pasa a revendedor marcándolo **Mayorista** en su ficha. Es una
decisión de una persona, no algo que dispare una cantidad: el ERP nunca lo
cambia solo, ni siquiera al convertir un lead que cotizó mucho.

**Las ventas a revendedores no pagan comisión.** Ya se les vende más barato, y
ese descuento es lo que se resigna; sumarle comisión sería resignarlo dos veces.
La pantalla del pedido lo explica en lugar de dejar el campo puesto, y la regla
también está en la base, así que vale aunque la comisión se cargue desde otro
lado.

La lista vive en la base y se edita desde **Precios**, cada una en su tabla. Lo
que guardes en la minorista es lo que cotiza el simulador de la landing al rato
siguiente, sin deployar nada.

`src/data/pricing.js` guarda una copia de la lista que se usa **sólo si la base
no contesta**, para que la web nunca quede sin precios. Conviene actualizarla
cuando el cambio de precios es grande, en el mismo commit en que se actualiza la
lista impresa.

### Reservas y fecha de retiro

El caso típico: llaman, dicen que la semana que viene pasan a buscar 50, y no
dan un día. Quieren que queden apartadas igual.

Eso se resuelve **confirmando el pedido**: reservar no es una operación nueva,
es el mismo paso de siempre. Lo que cambió es que ahora se ve. Desde que un
pedido está confirmado o en producción, sus varillas cuentan como reservadas y
salen del disponible, aunque sigan en el depósito. La pantalla de Stock muestra
los tres números:

- **Disponible** — el que se contesta por teléfono: cuántas se pueden vender.
- **En depósito** — cuántas hay físicamente.
- **Reservadas** — cuántas ya tienen dueño.

Un presupuesto no reserva nada, a propósito: todavía no es una venta, y apartar
mercadería contra una consulta paralizaría stock por nada.

La **fecha de retiro** (o de entrega, si va con envío) es aparte de la fecha del
pedido, que es cuándo se tomó y es la que ordena la contabilidad: un pedido de
marzo que se retira en abril se vendió en marzo. Y puede quedar vacía, que
significa "a confirmar". Es a propósito: obligar a elegir un día haría que
alguien invente uno, y una agenda llena de fechas inventadas es peor que una que
avisa cuáles faltan. El pedido lo muestra en el encabezado.

Si el disponible queda en negativo, hay más comprometido que fabricado y la
pantalla dice cuánto falta producir.

**Dónde se ve qué sale y cuándo.** En el **Panel**, arriba de todo, está *Para
entregar*: los pedidos confirmados y en producción ordenados por fecha, con los
"a confirmar" al final. Cada uno dice si hay que despacharlo —y a qué
localidad— o si lo retiran en fábrica, y cuánto apremia:

- **Atrasado** en rojo, con cuántos días pasaron.
- **Hoy** en rojo, **Mañana** y los tres días siguientes en ámbar.
- **A confirmar** en ámbar, porque es lo que hay que destrabar llamando.

El encabezado de esa tarjeta resume cuántos hay atrasados, para hoy y sin fecha.

La lista de **Pedidos** muestra lo mismo en su columna *Cómo y cuándo sale*, y
tiene un filtro para ver sólo los que hay que despachar o sólo los que retiran.
El criterio de urgencia es uno solo para las dos pantallas: si una dijera
"atrasado" donde la otra muestra gris, la que se mire primero decidiría el día.

### Stock

El número de existencias no se guarda: se calcula sumando los movimientos. Por
eso la pantalla muestra las dos cosas juntas, y por eso cuando algo no cuadra la
respuesta está en la lista de abajo.

- **Producción** y **devolución** suman; se cargan a mano.
- **Ajuste** puede sumar o restar: es el movimiento para cuando lo contado en el
  depósito no coincide. Se carga en negativo si falta mercadería.
- **Venta** la genera el sistema al entregar un pedido, y no se puede borrar a
  mano. Para revertirla hay que sacar el pedido del estado entregado.

### Fletes

Cada transporte se carga una vez con sus **zonas** —rangos de código postal— y,
dentro de cada zona, su **tarifario por cantidad**. El precio de una tarifa
tiene dos partes que se suman: un importe fijo por envío y otro por varilla.
Con una sola de las dos alcanza para el caso simple; las dos juntas cubren el
"mínimo más excedente" que cobran varios expresos.

Con eso cargado, el pedido contesta solo. Al poner el código postal en **Entrega
y flete** aparecen los transportes que llegan a ese destino con esa cantidad,
ordenados por precio y con el más barato marcado. Elegir uno completa el importe
del flete, que se puede corregir a mano antes de guardar: el tarifario es una
referencia, y lo que vale al final es lo que se pagó.

El camión propio se carga como un transporte más, con tipo *camión propio*.
Ponerle su tarifa es lo que permite comparar de verdad cuándo conviene mandarlo
en lugar de darlo por gratis, que es como se pierde plata sin verla.

La pantalla de **Fletes** tiene arriba un probador: código postal y cantidad, y
muestra la misma comparación sin tener que inventar un pedido de prueba.

### Documentos

Los tres papeles que se reparten —lista de precios, folleto y ficha técnica—
salen del ERP, y cada uno **con el contacto del vendedor que se elija**. Ese es
el punto: hasta ahora todos llevaban el teléfono de la empresa, así que cuando
el cliente llamaba no había forma de saber quién lo había traído. Ahora cada
vendedor reparte su versión y el cliente que responde es suyo.

Se elige el vendedor una vez en **Documentos** y los tres salen con sus datos.
El vendedor viaja en la dirección (`?vendedor=…`), así que el link de "el
folleto de Marta" se puede guardar o mandar por WhatsApp y siempre abre el suyo.
Un campo que el vendedor no tenga cargado se completa con el de la empresa, para
que no quede un renglón vacío en un papel que va a manos de un cliente; la
pantalla avisa cuáles faltan.

Reemplazan a los HTML sueltos de `docs/`, que quedan como referencia de cómo era
cada uno. Tres cosas cambian:

- **La lista de precios lee de la base.** Antes había que reeditar el archivo
  cada vez que cambiaba un escalón, y entre una cosa y la otra siempre había
  alguien repartiendo la lista vieja. También el recargo por agujereado y la
  fecha de vigencia salen de los datos: el recargo es la diferencia entre las
  dos columnas y la vigencia es la última vez que se tocó un precio, así que ya
  no pueden contradecir a la tabla que tienen al lado.
- **El folleto sale con el contacto lleno.** El archivo traía "Nombre y
  Apellido · 011 0000-0000" de ejemplo, y la mitad de las copias se repartían
  así.
- **La ficha técnica ya no trae los controles de dibujo.** Cambiar largo, ancho
  y perforaciones servía para *diseñar* la ficha, no para emitirla; el producto
  tiene una sola medida. El dibujo sigue siendo paramétrico por dentro, así que
  el día que haya otra varilla alcanza con pasarle otras medidas. Lo que sí se
  conserva son las marcas de dato pendiente: lo que no se midió sale señalado y
  no escrito como si estuviera verificado.

El presupuesto no está en esta pantalla porque no es un papel general: sale de
cada pedido. También lleva al pie el contacto de su vendedor.

### Vendedores y comisiones

Cada vendedor tiene un porcentaje habitual —el 5% de arranque—, que es el que se
propone al cargarlo en un pedido. Lo que se paga sale de cada venta, que guarda
el suyo: si un pedido grande se negocia distinto, cambiar después la ficha del
vendedor no reescribe lo que ya se acordó.

Tres reglas que conviene tener claras:

- **Se calcula sobre la mercadería sola.** El flete no es plata de la empresa:
  entra y sale hacia el transporte.
- **Se devenga a medida que el cliente paga**, no cuando se entrega. Un pedido
  entregado y sin cobrar todavía no le debe nada a nadie.
- **Un pedido anulado no devenga nada**, aunque tenga cobros cargados.

La pantalla de **Vendedores** muestra abajo la liquidación del mes: cuánto le
toca a cada uno y, desplegando, los pedidos que lo componen.

El teléfono, el email y la localidad no son datos internos: son los que salen
impresos en su folleto y en su lista de precios. Conviene tenerlos completos
antes de que empiece a repartir.

### Costos

Todo lo que sale de la empresa se carga en **Costos**. El tipo no es una
etiqueta para ordenar: **define quién paga el gasto**, y son dos grupos:

| Los paga la empresa | Los paga la reinversión |
| ------------------- | ----------------------- |
| Producción          | Pauta                   |
| Flete               | Muestras                |
|                     | Suscripciones           |
|                     | Otros                   |

Los de la izquierda se restan de la ganancia antes de repartir. Los de la
derecha los paga la parte de reinversión del reparto, que para eso existe: ese
5% no es plata que se guarda, es plata con destino.

Por eso el selector está agrupado así y no como una lista plana: poner un gasto
en el grupo equivocado no desordena un informe, le mueve plata a alguien.

Un gasto puede imputarse a un pedido por su número —un flete que se pagó, una
producción especial— o quedar suelto en el mes, como la pauta. No hay un segundo
lugar donde anotar gastos.

### El reparto

**Rentabilidad** junta las dos mitades y muestra el mes completo:

```
   Mercadería + flete facturado
 − comisiones
 − producción, flete bonificado
 ─────────────────────────────
 = ganancia a repartir   →   se reparte por porcentaje
 − pauta, muestras, suscripciones, otros   (los paga la reinversión)
 ─────────────────────────────
 = ganancia neta del mes
```

Cuenta como venta todo pedido confirmado en adelante, por su fecha; los
presupuestos y los anulados no entran, igual que en la cuenta corriente.

Los porcentajes se editan en la misma pantalla y arrancan en 50 / 25 / 20 y un 5
de reinversión.

**La reinversión no es una parte que se guarda: es la que paga la pauta, las
muestras, las suscripciones y los gastos sueltos de crecer.** Por eso su
porcentaje no es fijo:

1. Arranca en su **5%**. Si con eso cubre esos gastos, listo.
2. Si no alcanza, sube a **7,5%**.
3. Si tampoco, a **10%**.

Sube al primer escalón que alcanza, no al máximo. Los puntos que sube salen de
los socios, a cada uno **en proporción a lo suyo**. Con un reparto 50/25/20,
subir 2,5 puntos le saca 1,32 a quien tiene la mitad y 0,53 a quien tiene el
veinte:

| Gastos de reinversión sobre $1.000.000 | Tasa | Gustavo | Pipo | Lui | Reinversión |
| --- | --- | --- | --- | --- | --- |
| $40.000 | 5% | 50% | 25% | 20% | 5% |
| $60.000 | 7,5% | 48,68% | 24,34% | 19,47% | 7,5% |
| $90.000 | 10% | 47,37% | 23,68% | 18,95% | 10% |

### El pozo no se cierra cada mes

Lo que la reinversión junta y no gasta **queda de reserva para el mes
siguiente**. Eso cambia dos cosas:

- **La escalera mira la reserva.** Si con lo que sobró del mes pasado más su 5%
  ya cubre los gastos, no sube: sería cobrarles dos veces a los socios teniendo
  pozo sin usar.
- **El gasto consume primero la plata más vieja.** Así se liquida sólo lo que de
  verdad quedó quieto, y no se va venciendo el pozo de un mes que sí se está
  usando.

**La reserva tiene un mes de gracia, no más.** Lo que venía del mes anterior y
tampoco se usó este mes dejó de ser reserva: se liquida a los socios **a la
inversa de sus porcentajes**. El peso de cada uno es 1 dividido su parte, así
que con 50/25/20 queda:

| | Parte de la ganancia | Del pozo que vence |
| --- | --- | --- |
| Gustavo | 50% | 18,18% |
| Pipo | 25% | 36,36% |
| Lui | 20% | 45,45% |

El que menos tiene es el que más cobra. La lógica es que el pozo se financió
sacándole a cada uno en proporción a lo suyo —el que más tiene puso más—, así
que devolverlo sin haberlo usado compensa a quien proporcionalmente más le pesó
ponerlo. Y le pone un techo natural al pozo: no puede engordar para siempre sin
que nadie decida nada.

Un ejemplo de tres meses con $1.000.000 de ganancia:

```
julio       fondo 50.000 · gasta 20.000 · quedan 30.000 de reserva
agosto      reserva 30.000 + fondo 50.000 · gasta 40.000 (los 30.000 viejos
            primero) · quedan 40.000
septiembre  reserva 40.000 + fondo 50.000 · gasta 10.000
            → vencen 30.000 de la reserva vieja: se liquidan
              Gustavo 5.455 · Pipo 10.909 · Lui 13.636
            → quedan 50.000 de reserva
```

### Registrar lo que se pagó

El reparto era hasta acá una cuenta en pantalla: decía cuánto le tocaba a cada
uno pero no quedaba constancia de qué se pagó. Eso alcanza el primer mes y deja
de alcanzar al tercero, cuando alguien pregunta si ya cobró lo de septiembre y
la única respuesta es la memoria de otro.

Ahora cada socio tiene su liquidación, tanto de su parte del mes como de lo que
le toca del pozo vencido, y **se puede pagar de una vez o en partes**:

- **Liquidar** paga todo lo que falta de un clic. Es el caso normal.
- **parte** abre el detalle, con un campo para poner el monto a mano. Es cuando
  se paga a cuenta porque no está toda la plata junta.

El detalle muestra las tres cifras que importan —le toca, pagado, falta—, la
lista de los pagos ya hechos con la opción de borrar cualquiera, y mientras
escribís el monto te dice cómo queda el saldo después de ese pago. La fila de la
tabla queda diciendo *Pagado $80.000 · falta $40.000* hasta que se completa.

Abajo de la tabla se ve cuánto se liquidó del total del mes, y avisa cuando está
**todo pagado**.

Dos detalles:

- **El monto se congela al pagar.** Si después se corrige un gasto viejo y la
  cuenta del mes se mueve, lo pagado sigue diciendo lo que se pagó. La
  diferencia queda a la vista, que es para lo que sirve tener el registro.
- **La reinversión no se liquida**: su parte no se le paga a nadie, va al pozo.
  Lo que sí se liquida es el pozo cuando vence.

> La base tenía una restricción que impedía dos pagos del mismo socio en el
> mismo mes, justamente para que dos clics no generaran un doble pago. Se sacó
> al permitir el pago parcial, porque prohibía algo que hay que poder hacer.
> Contra el doble pago protege ahora la pantalla, que muestra el saldo antes de
> registrar nada: es más débil, pero no impide lo legítimo.

### La cuenta de cada socio

Todo lo anterior mira un mes. La tarjeta **Cuenta de cada socio**, al final de
Rentabilidad, mira el historial completo y contesta la pregunta que no se puede
responder mes por mes: *cuánto le tocó en total, cuánto cobró y qué falta*.

El **saldo** dice **al día** cuando está saldado, en ámbar cuando se le debe y
en rojo cuando se le pagó de más. Desplegando *Ver mes por mes* se ve el detalle
de cada liquidación —reparto o pozo vencido— con lo que correspondía y lo que se
cobró; hacer clic en una fila lleva la pantalla a ese mes.

Una diferencia que conviene entender: **«le tocó» se recalcula siempre con los
datos de hoy y «cobró» es lo que quedó registrado al pagar.** Si aparece un
saldo donde no debería, casi siempre es que se corrigió un gasto de un mes ya
liquidado y la cuenta de ese mes se movió después de pagar. Eso es información,
no un error: la diferencia se ve en vez de perderse.

**Si un mes dio pérdida no escala**: un porcentaje de un número negativo no
cubre nada, y subirlo sólo repartiría la pérdida distinto.

**Si ni con el 10% alcanza**, la pantalla lo dice en rojo con cuánto falta. Los
montos se reparten igual, así que ese hueco todavía no tiene de dónde salir: hay
que recortar el gasto, ponerlo del bolsillo o descontarlo del reparto a mano. El
ERP no lo resuelve solo a propósito, porque es una decisión de los socios.

La comisión del vendedor se descuenta antes de repartir, así que la absorben
todos en proporción a su parte: con 5% de comisión, quien tiene el 50% resigna
2,5 puntos, quien tiene el 25% resigna 1,25 y la reinversión resigna 0,25.

Si los porcentajes no suman 100, el ERP lo avisa y muestra cuánta plata queda
sin asignar, en vez de estirar los números para que cierre. Un reparto que
cierra siempre no deja ver que la lista está mal cargada.

Un detalle a tener presente: la comisión se imputa al mes del pedido pero se
devenga cuando el cliente paga, así que un mes ya cerrado puede moverse un poco
si entra un cobro viejo. Es a propósito: la alternativa era llevar dos fechas
por comisión, y no vale la complicación para un equipo de tres.

---

## Cosas que conviene saber

**Los leads se guardan en dos lados.** El simulador escribe en Supabase y
además sigue mandando todo a la planilla de Google de siempre (ver
[`planilla-de-contactos.md`](planilla-de-contactos.md)). Es a propósito
mientras dure la transición: la planilla queda como respaldo y no se pierde el
histórico. Para cortarla, vaciá `LEADS_ENDPOINT` en
[`src/lib/leads.js`](../src/lib/leads.js).

**Cualquiera con la clave pública puede dejar un lead.** Es la misma exposición
que ya tenía la planilla de Google, y para juntar contactos que la gente deja
voluntariamente no es un problema. Lo que no puede hacer nadie desde afuera es
*leerlos*: la política sólo permite insertar. Por las dudas, no guardes nada
sensible en esa tabla.

**El ERP no aparece en Google.** `public/robots.txt` lo excluye y la pantalla
agrega una etiqueta `noindex`. De todos modos pide login, así que eso es sólo
para que no figure en las búsquedas.

**Todos los usuarios ven todo.** No hay roles: quien entra, trabaja con todo el
sistema. Si en algún momento hace falta separar (por ejemplo, que producción no
vea los precios de compra), se hace con políticas nuevas en Supabase, sin tocar
las pantallas.

**Sin las variables de entorno, la landing anda igual.** Muestra los precios del
código y el simulador funciona; lo único que no pasa es que se guarde el lead en
la base. El ERP, en cambio, avisa que falta configurarlo.

**Los importes son todos sin IVA**, igual que la lista impresa. La única
excepción es visual: el presupuesto se puede exportar con el 21% agregado para
el cliente que lo pide, sin que eso toque lo que hay guardado.

**El flete ya no se carga a ciegas.** Con el tarifario de Fletes cargado, el
pedido propone los transportes que llegan al destino con su precio; el importe
igual se puede escribir a mano, y mientras esté vacío el pedido dice "a
cotizar", que es distinto de decir cero.

**El ERP no le pesa a la landing.** Se carga aparte y sólo al entrar a `/erp`:
son unos 59 KB comprimidos que quien visita la web pública no descarga nunca.

---

## Respaldo

Supabase hace copias automáticas en el plan gratuito, pero se guardan pocos
días. Para una copia propia: **Database → Backups**, o desde el panel de cada
tabla el botón de exportar a CSV.

Vale la pena bajarse `orders`, `order_items`, `payments` y `customers` de vez en
cuando: son los datos que no se pueden reconstruir.
