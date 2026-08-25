# Planilla de contactos del simulador

Cada vez que alguien calcula un presupuesto en la web, sus datos y el número que
le dio se guardan en una planilla de Google. Sirve para llamar después a quien
coticé y no compró, y preguntarle qué lo frenó.

Es gratis y no hace falta servidor: la planilla misma recibe los datos.

## Armarlo (una sola vez, unos 10 minutos)

### 1. Crear la planilla

Entrá a [sheets.new](https://sheets.new) y ponele un nombre, por ejemplo
**Recuvarilla — Presupuestos**.

En la **primera fila** escribí estos títulos, cada uno en su columna:

```
fecha | nombre | telefono | email | cantidad | agujereada | entrega | codigoPostal | localidad | provincia | kilometros | precioUnitario | mercaderia | flete | total
```

Los nombres tienen que estar escritos exactamente así, sin acentos y sin
espacios: el script busca cada columna por su título, así que después podés
reordenarlas o agregar columnas propias sin romper nada.

### 2. Pegar el script

En la planilla: menú **Extensiones → Apps Script**. Borrá lo que haya y pegá
esto:

```javascript
/**
 * Recibe los presupuestos simulados en la web y los agrega a la planilla.
 *
 * Las columnas se ubican por el título de la primera fila, así que se pueden
 * reordenar o agregar sin tocar este código.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // dos personas simulando a la vez no se pisan

  try {
    var datos = JSON.parse(e.postData.contents);
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];

    var fila = titulos.map(function (titulo) {
      var valor = datos[titulo];
      return valor === undefined ? '' : valor;
    });

    hoja.appendRow(fila);
    return ContentService.createTextOutput('ok');
  } catch (error) {
    return ContentService.createTextOutput('error: ' + error);
  } finally {
    lock.releaseLock();
  }
}
```

Guardá con el disquete.

### 3. Publicarlo

Botón **Implementar → Nueva implementación**.

- En el engranaje elegí **Aplicación web**
- **Ejecutar como**: Yo
- **Quién tiene acceso**: **Cualquier usuario** ← importante, si no la web no
  puede escribir
- **Implementar**

Google te va a pedir permiso para acceder a tus planillas. Como el script es
tuyo y no está verificado, aparece una advertencia: entrá en **Configuración
avanzada → Ir a (nombre del proyecto)** y aceptá.

Al final te da una **URL** que termina en `/exec`. Copiala.

### 4. Enchufarla en la web

Abrí [`src/lib/leads.js`](../src/lib/leads.js) y pegá la URL:

```js
export const LEADS_ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec'
```

Listo. El próximo presupuesto que se simule aparece en la planilla.

## Cosas que conviene saber

**Mientras la URL esté vacía, el simulador funciona igual.** Muestra el
presupuesto y abre WhatsApp; lo único que no pasa es que se guarde el contacto.

**Si el guardado falla, la persona igual ve su presupuesto.** El envío no espera
respuesta y los errores se descartan a propósito: un problema con la planilla no
puede costarte una venta.

**Los datos van como `text/plain`.** Puede parecer raro tratándose de JSON, pero
es a propósito: si se mandaran como `application/json` el navegador haría antes
un pedido de permiso que Apps Script no contesta, y la llamada fallaría. Del
otro lado se parsea igual.

**Al cambiar el script hay que volver a implementar.** Apps Script sigue
sirviendo la versión publicada hasta que hacés **Implementar → Administrar
implementaciones → editar → Versión nueva**. La URL se mantiene.

**Cualquiera que tenga la URL puede escribir en la planilla.** Está a la vista en
el código de la web, así que asumí que es pública. Para lo que hace —juntar
contactos que la gente deja voluntariamente— no es un problema, pero no le
agregues información sensible a esa planilla.
