# Recuvarilla · Marca

Todo lo que hace falta para que una pieza de Recuvarilla se vea como Recuvarilla.

- **El manual:** [`manual/recuvarilla-manual.pdf`](manual/recuvarilla-manual.pdf), 44 páginas. Para mandar, imprimir o leer en el celular.
- **La versión navegable:** [`manual/index.html`](manual/index.html). Abrila con Chrome o Edge. Tiene menú, el logo animado y el botón "Guardar PDF".
- **Los archivos:** [`assets/`](assets/), explicados abajo.

## Qué archivo uso para…

| Necesito… | Archivo |
|---|---|
| El logo para casi todo | `assets/logo/recuvarilla-principal-color.svg` |
| El logo sobre fondo oscuro | `assets/logo/recuvarilla-principal-negativo.svg` |
| El logo en Word, Canva o WhatsApp (sin SVG) | `assets/logo/png/` |
| La foto de perfil de WhatsApp o Instagram | `assets/logo/png/recuvarilla-isotipo-color-1024.png` |
| Los colores | `assets/colors/paleta.txt` |
| Las fuentes | `assets/fonts/instalar/` (las 5, doble clic e "Instalar") |
| Un posteo o una historia | `assets/templates/` (ver abajo) |
| El QR de WhatsApp | `assets/qr/qr-whatsapp.svg` o `.png` |
| La medida de la varilla en un catálogo | `assets/producto/dimensiones-*.svg` |
| El sello para un distribuidor | `assets/sello/distribuidor-oficial.svg` |

## Las carpetas

**`logo/`**: cuatro versiones (principal, palabra, vertical, isotipo), cada una en `color`, `negativo`, `negro` y `blanco`. Los SVG no dependen de ninguna fuente. En `png/` están las versiones más usadas, para quien no puede abrir un SVG. El área de protección, los tamaños mínimos y los usos prohibidos están en el manual, páginas 6 a 10.

**`colors/`**: la paleta en cuatro formatos, con el mismo contenido:
- `paleta.txt` para leer, con HEX, RGB y CMYK;
- `paleta.css` para la web;
- `paleta.json` para programas;
- `paleta.gpl` para GIMP e Inkscape.

Antes de una tirada grande, pedí una prueba impresa.

**`fonts/`**: Archivo y Chivo Mono, de Omnibus-Type (Buenos Aires). Son gratuitas, con licencia OFL (`OFL-*.txt`).
- En `instalar/` están las cinco versiones fijas que usa la marca.
- Los dos archivos variables de la raíz son para la web.
- En Canva Pro se suben como fuentes de marca.

**`fotos/`**: las fotos aprobadas, ya achicadas. Las que empiezan con `NO-` son ejemplos de lo que no se hace; no las uses en piezas. La lista de fotos que faltan sacar está en la página 21 del manual.

**`sistema/`**: los recursos que hacen que algo "parezca Recuvarilla":
- la varilla separador;
- la viñeta agujero;
- el pattern alambrado (módulo suelto y armado de 1080);
- la regla de 120 cm.

Regla principal: la varilla nunca se estira.

**`producto/`**: el gráfico de dimensiones de la varilla lisa y la perforada, en positivo y negativo, y los esquemas de aplicaciones en `aplicaciones/`.

**`iconos/`**: nueve íconos propios, cada uno también en `-blanco`. En `tecnicos/` están las cuatro etiquetas de la ficha: 120 cm, 3 × 3 cm, plástico reciclado y agujereado disponible.

**`qr/`**: abre el chat de WhatsApp con "Hola, quiero un presupuesto de varillas" ya escrito.

**`sello/`**: "Distribuidor oficial", para agropecuarias y ferreterías que revenden.

**`motion/`**: el logo animado (`logo-animado.svg`, se abre en el navegador) y los cuatro cuadros del storyboard. `logo-animable.svg` tiene las partes separadas, para quien anime en otro programa.

**`templates/`**: los seis tipos de posteo del manual (producto, aplicaciones, educación, proceso, pruebas, marca). Cada uno sale en cuadrado 1080 × 1080 y en historia 1080 × 1920. Los PNG listos están en `templates/png/`.

## Cómo hacer un posteo nuevo

1. Copiá la plantilla que corresponda. Por ejemplo, `templates/producto.html` a `templates/producto-octubre.html`.
2. Abrila con un editor de texto y cambiá solo lo que está después de `<!-- EDITÁ -->`. Las fotos se cambian en el `src` de la imagen, con una foto de `assets/fotos/`.
3. Para verla, abrila en Chrome. Para ver la historia, agregá `?formato=historia` al final de la dirección.
4. Para exportar el PNG, desde la carpeta del repo:

   ```bash
   bash brand/herramientas/render-plantillas.sh producto-octubre
   ```

   Quedan dos PNG en `templates/png/`, uno cuadrado y uno de historia. Sin el nombre, exporta todas.

## Para quien mantiene esto

Los SVG del logo, del producto, de los íconos y el QR **no se dibujaron a mano**: salen de los scripts de `herramientas/`. Si cambia algo (el teléfono, una medida, el grosor de la varilla), se edita el script y se regenera. No hay que tocar los SVG uno por uno.

```bash
pip install -r brand/herramientas/requirements.txt
python brand/herramientas/generar_logo.py       # assets/logo (el PNG se exporta aparte)
python brand/herramientas/generar_producto.py   # assets/producto
python brand/herramientas/generar_iconos.py     # iconos, técnicos, sello, motion (usa el logo)
python brand/herramientas/generar_qr.py         # assets/qr
```

- Los scripts leen las fuentes de `assets/fonts/` y convierten el texto en trazos con HarfBuzz, respetando el kerning. Por eso los SVG se ven igual en cualquier máquina.
- Correrlos sin cambios reproduce los archivos actuales exactamente igual. Se comprobó comparando los 64 SVG antes y después.
- El PDF del manual se exporta desde Chrome con "Guardar PDF", en A4 horizontal y sin márgenes, o con Chrome sin ventana:

  ```bash
  chrome --headless=new --no-pdf-header-footer --virtual-time-budget=8000 \
    --print-to-pdf=brand/manual/recuvarilla-manual.pdf brand/manual/index.html
  ```

- Los precios que aparecen en el manual son los de la lista vigente desde el 01/08/2026 (`src/data/pricing.js`). Cuando cambie la lista, actualizá las páginas 13, 14, 23, 28, 30 y 38 y volvé a exportar el PDF.
