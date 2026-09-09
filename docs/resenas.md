# Las reseñas de la sección de testimonios

Las reseñas que muestra la landing se cargan **a mano**, en
[`src/data/siteContent.js`](../src/data/siteContent.js). Cuando entra una buena
en el perfil de Google, se copia ahí y se deploya. No hay claves, ni servicios
de terceros, ni factura posible.

## Agregar una reseña

Abrir el perfil en Google Maps, buscar la reseña y copiarla al array
`testimonials`:

```js
{
  author: 'Martín G.',
  place: 'Chivilcoy',
  when: 'Marzo de 2026',
  rating: 5,
  text: 'Compré 300 varillas y me resolvieron la entrega en la semana. Muy conformes.',
  url: 'https://www.google.com/maps/reviews/...',
},
```

Sólo `author` y `text` son obligatorios. Lo demás mejora la tarjeta pero se
puede omitir:

| campo | qué hace si falta |
|---|---|
| `rating` | la tarjeta sale sin estrellas |
| `place` / `when` | no se muestra la línea gris bajo el nombre |
| `photo` | se dibuja la inicial del nombre en un círculo verde |
| `url` | no aparece el enlace "Ver en Google" |

(El botón para que los clientes escriban una reseña es otra cosa y se configura
aparte: ver más abajo.)

Tres criterios al copiar:

- **El texto va tal cual.** Sin corregir la ortografía, sin recortarlo y sin
  mejorarlo. Una reseña retocada se nota y quema la credibilidad de todas las
  demás.
- **El nombre, como figura en Google.** Si dice "Martín G.", va "Martín G.".
  Nunca completar el apellido ni inventar uno: es el dato de una persona real.
- **`when` con el mes, no con "hace 3 meses".** Un "hace 3 meses" escrito a mano
  envejece solo y en un año miente.

## Cómo se muestran

**En pantalla hay siempre dos** (una sola abajo de 640px, donde no entran dos al
lado). Si hay más, la sección se vuelve un carrusel que **pasa al par siguiente
cada 20 segundos**, con flechas y puntitos abajo para moverse a mano. Con dos o
menos no aparece ningún control: la grilla suelta y listo.

El carrusel se frena solo en tres casos, porque veinte segundos es mucho tiempo
para que algo se mueva sin permiso:

- mientras la sección está fuera de pantalla,
- con el puntero encima —alguien leyendo una reseña larga no se queda a mitad—,
- y con el foco adentro, para quien recorre los enlaces con el teclado.

Con `prefers-reduced-motion` activado en el sistema no arranca nunca: quedan las
flechas y los puntos para pasarlo a mano.

Todas las reseñas están siempre en el HTML, aunque no se vean: se mueve el
scroll, no se reemplaza el contenido. Para Google y para un lector de pantalla
la lista está entera.

Conviene entonces dejar **cuatro o seis** —las más representativas, de distintas
zonas— y no una lista larga. Ya no alarga la sección, pero cada par de más es un
grupo al que casi nadie va a llegar: a partir del tercero hay que esperar 40
segundos o tocar los puntitos. El número total ya lo comunica la insignia.

Si algún día conviene mostrar otra cantidad o cambiar el tiempo, son dos
constantes arriba de
[`src/components/Testimonials.jsx`](../src/components/Testimonials.jsx):
`PER_PAGE` y `PAGE_MS`.

## La insignia con el promedio

Arriba a la derecha va el promedio del perfil, la cantidad de reseñas y el
enlace a Google. Es probablemente lo que más convence, porque ese número lo pone
Google y no nosotros. Vive en `reviewsSummary`, en el mismo archivo:

```js
export const reviewsSummary = {
  rating: 4.9,
  total: 27,
  url: 'https://g.page/r/CXxxxxxxxxxxEBM',
}
```

Arranca en `null` y así **la insignia no se dibuja**. Es a propósito: publicar
un promedio inventado sería de las pocas cosas de esta web que serían
directamente una mentira. Se completa cuando estén los datos reales.

- `rating` y `total` se leen del perfil en Google Maps.
- `url` es el enlace al perfil. El corto (`g.page/r/...`) sale del panel del
  perfil de empresa, en **Pedir reseñas**; también sirve el largo que da
  **Compartir** en Maps.

Este resumen conviene revisarlo cada tanto aunque no se agreguen reseñas
nuevas: es el dato que más rápido queda viejo.

## El botón para que dejen una reseña

Al final de la sección hay una invitación con un botón que abre el formulario de
Google directamente, con las estrellas listas para tocar. Ese paso de menos es
casi todo: la mayoría de la gente que quiere dejar una reseña se pierde buscando
dónde.

Vive en `reviewLink`, en el mismo archivo:

```js
export const reviewLink = 'https://g.page/r/CXxxxxxxxxxxEBM/review'
```

Cómo conseguirlo: buscar el negocio en Google con la cuenta que administra el
perfil y, en el panel de la derecha, **Pedir reseñas**. Da un enlace corto
terminado en `/review`. Si esa opción no aparece, el largo hace exactamente lo
mismo y se arma con el Place ID:

```
https://search.google.com/local/writereview?placeid=ChIJ...
```

Vacío, el botón no se dibuja y la sección termina en las tarjetas (o en el
enlace al perfil, si `reviewsSummary` está cargado).

**Conviene usar el mismo enlace fuera de la web.** Mandado por WhatsApp uno o
dos días después de una entrega es cuando más gente contesta; en la web lo va a
tocar poca, porque quien entra a la landing casi nunca es todavía cliente. La
sección igual lo tiene porque no cuesta nada tenerlo.

## Fotos (opcional)

`photo` apunta a un archivo dentro de [`public/`](../public/):

```js
photo: 'resenas/martin.jpg',
```

En general no hace falta. El círculo con la inicial queda bien, y bajar una
imagen por cliente para 40 píxeles de pantalla no se paga. Si se usa, que sea
recortada cuadrada y de 80×80 como mucho.

## Por qué a mano y no con la API de Google

Google tiene una API que las trae solas, pero:

- El campo `reviews` cae en su SKU más caro (US$40 cada mil llamadas) y **exige
  una tarjeta cargada** en Google Cloud aunque el uso entre en la cuota gratis
  de mil llamadas al mes.
- Devuelve **hasta cinco reseñas**, elegidas por Google. Ni todas, ni las más
  nuevas, ni las que uno quiera.
- Suma una función de servidor, una clave que administrar y un servicio más del
  que depende que la sección se vea.

Cargarlas a mano no tiene nada de eso y encima permite elegir cuáles se
muestran. El costo es el rato que lleva copiar una reseña nueva cada tanto, que
para el volumen de un negocio chico es poco.

Si algún día conviene automatizarlo, el camino es ése: una función de servidor
que consulte Places API (New) con caché de un día, más un tope de cuota en
Cloud Console para que nunca llegue una factura.
