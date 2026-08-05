# Recuvarilla — Landing

Landing page de Recuvarilla, empresa dedicada a la producción y venta de
varillas para el campo elaboradas con material recuperado de polipropileno.

## Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- JSX
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Three.js](https://threejs.org/) vía [React Three Fiber](https://r3f.docs.pmnd.rs/) para la escena 3D

## La historia de la varilla (sección 3D)

[`src/components/RodStory.jsx`](src/components/RodStory.jsx) es una sección de
scroll con canvas fijo que narra en 6 capítulos el recorrido del material:
botellas recuperadas → tolva → fundido → molde → perforado → colocación en la cerca.

- La escena vive en [`src/three/RodScene.jsx`](src/three/RodScene.jsx) y está
  construida **enteramente con geometría procedural** (cilindros, cajas, conos,
  toros). No depende de ningún modelo 3D externo.
- El progreso del scroll se calcula en
  [`src/hooks/useScrollProgress.js`](src/hooks/useScrollProgress.js) y se pasa
  por `ref` para no re-renderizar React en cada frame.
- Three.js se carga en un chunk aparte y sólo cuando la sección se acerca al
  viewport (`IntersectionObserver`).
- Con `prefers-reduced-motion` se muestra una versión estática en texto.

### Texturas

Las texturas se **generan por código** en un canvas al cargar
([`src/three/proceduralTextures.js`](src/three/proceduralTextures.js)), no se
descargan. Un set PBR fotográfico de Poly Haven pesa ~2 MB por material y 1K es
su resolución más chica: los cuatro materiales habrían sumado ~8,5 MB a una
sección que hoy pesa 237 KB. Acá el costo de red es cero.

Hay cuatro juegos: plástico reciclado con motas (varilla), plástico liso
(botellas), metal cepillado (máquina) y madera (postes). Se construyen una vez
y cada uso los clona para fijar su propia repetición.

Dos criterios detrás del diseño:

- **El metal y las botellas no llevan mapa de color**, sólo relieve y
  rugosidad. Así cada pieza conserva el gris o el tinte que ya tenía en vez de
  aplanarse todo al mismo tono.
- **Los mapas de rugosidad se generan claros**, cerca del blanco, porque three
  los multiplica por el `roughness` del material. Agregan variación sin pisar
  los valores ya ajustados de cada cuerpo.

**Cuidado al escalar:** escalar un objeto no escala sus UV. La varilla, los
postes y los alambres crecen escalando, así que su `repeat` se actualiza en
`useFrame` siguiendo al escalado. Sin eso la textura sale comprimida y se
estira sola mientras el cuerpo crece.

### Escala y proporciones

La varilla real mide **3 x 3 x 120 cm**, así que es un prisma de sección
cuadrada con proporción 1:40. En `RodScene.jsx` se fija `ROD_LENGTH` en
unidades de escena y el lado se deriva de ahí, igual que el alto de las
botellas (22 cm). Cambiando `ROD_LENGTH` escala todo junto sin romper las
proporciones.

### Ajustar el ritmo

Tres perillas, de la más usada a la menos:

- **Cuánto hay que scrollear**: `SECTION_HEIGHT_VH` en `RodStory.jsx`. Es el
  alto de la sección en pantallas; el scroll útil es ese valor menos 1.
- **Qué dura cada capítulo**: los `range` en
  [`src/data/storyChapters.js`](src/data/storyChapters.js), junto con sus
  textos. Los usan tanto la escena 3D como la capa de texto, así que editando
  ese archivo las dos cosas quedan sincronizadas.
- **Qué tan suave se siente**: el parámetro `smoothing` de `useScrollProgress`.
  El progreso persigue al scroll en vez de seguirlo literal, para que cada
  rueda del mouse no produzca un salto.

El recorrido de cámara está aparte, en `CAMERA_KEYFRAMES` dentro de
`RodScene.jsx`.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Contenido

El contenido de texto (productos, proceso, beneficios, datos de contacto,
etc.) es de ejemplo y vive en [`src/data/siteContent.js`](src/data/siteContent.js).
Reemplazar por la información real de la empresa. Las imágenes son
placeholders marcados con `[ ... ]` dentro de cada componente en
[`src/components`](src/components).

## Paleta de colores

Definida en [`src/index.css`](src/index.css) como escalas de Tailwind:

- `primary` — celeste de marca (`#6cace4`)
- `secondary` — verde de marca (`#35610e`)
- `steel` — grises neutros de apoyo
