# brag-plan — Recuvarilla

## El ángulo

La comparación ya estaba hecha, en su propia foto: `alambrado-1.jpg` muestra un
alambrado real con **postes negros de Recuvarilla alternados con postes de
madera**. No hay que explicar la ventaja, se ve. El video parte de ahí.

No se vende "plástico reciclado" como causa ambiental — se vende un poste que no
se pudre. Lo sustentable viene después, de yapa. Es el orden en que lo pone la
propia landing: el h1 dice *resistentes* primero y *recuperado* segundo.

## El gancho

Dos líneas secas sobre negro, una después de la otra:

> La madera se pudre.
> El hierro se oxida.

Salen de su propia copy (`benefits`: *"No se oxida ni se pudre. A diferencia de
la madera y el metal, resiste la intemperie sin mantenimiento"*). Corte duro a
la foto del alambrado: **Ésta no.**

## Highlights

1. **Qué es** — varilla de plástico recuperado, 120 cm, 3 × 3 cm. Sobre la foto
   cenital de las tres varillas en el pasto.
2. **El sitio andando** — el hero real de la landing, grabado del navegador:
   el alambrado 3D se abre y queda una varilla sola en primer plano. Es
   animación del sitio, no una recreación.
3. **El producto en uso** — el simulador de la web cotizando de verdad: se
   tipean 500 varillas y aparece el precio. Números reales de `PRICE_TIERS`
   (escalón 500–999 sin agujerear = $2.850).
4. **Existe y hay stock** — el pallet de `stock.png`, que es lo que hace creíble
   un pedido de 500.

## Punchline

El precio en pantalla, sin pedir mail ni esperar a que alguien conteste. La
promesa concreta de la landing.

## Tono

`default` tirando a `polished`. Público rural, producto serio, nada de humor
forzado ni de lenguaje de SaaS. Frases cortas, mucho aire, cortes limpios.

## Identidad visual

Tomada del CSS real (`src/index.css`):

| Rol | Token | Hex |
| --- | --- | --- |
| Fondo oscuro | `steel-900` | `#16181c` |
| Fondo claro | `steel-50` | `#f5f6f7` |
| Texto fuerte | `steel-900` / blanco | `#16181c` |
| Texto secundario | `steel-500` | `#5b6570` |
| Acento / precio / CTA | `secondary-500` | `#35610e` |
| Detalle | `primary-400` | `#6cace4` |

Tipografía: el mismo stack por defecto de Tailwind que usa el sitio
(`ui-sans-serif, system-ui, "Segoe UI"…`), `font-extrabold` y `tracking-tight`
en los títulos, igual que el `h1` del hero.

## Storyboard

Landscape 1920×1080, 30 fps, **22,0 s** (660 cuadros).

| # | Desde | Dura | Escena | Qué pasa |
| --- | --- | --- | --- | --- |
| 1 | 0,0 s | 3,0 s | **Gancho** | Negro. «La madera se pudre.» entra a los 0,3 s; «El hierro se oxida.» a los 1,4 s. Las dos quedan quietas hasta el corte. |
| 2 | 3,0 s | 3,6 s | **Revelación** | Corte duro a `alambrado-1` (negros + madera en la misma línea), push-in lento. «Esta no.» y abajo, chico: «Varilla de plástico recuperado». |
| 3 | 6,6 s | 3,3 s | **Qué es** | `varilla-sa`, deriva lenta. Tres datos entrando uno por uno: 120 cm · 3 × 3 cm · No se oxida ni se pudre. |
| 4 | 9,9 s | 3,4 s | **El sitio** | El hero real grabado del navegador: el alambrado 3D se abre y queda una varilla sola. Sin texto encima — el sitio ya trae el suyo. |
| 5 | 13,3 s | 5,0 s | **En uso** | El simulador real: se tipea `500`, y el resultado se arma solo — 500 varillas × $2.850 → **$1.425.000** sin IVA. |
| 6 | 18,3 s | 3,7 s | **Cierre** | Logo sobre blanco, tagline, teléfono real y Luján. |

Transiciones: corte duro 1→2 (es el golpe del gancho). Los demás, bajada al
fondo y subida — nunca crossfade entre dos fotos, que embarra.

### Sobre el hero (escena 4)

La idea era el meceo del alambrado que tiene el hero en la web. **No se puede
capturar desde headless**, y conviene que quede escrito por si alguien lo vuelve
a intentar:

- El meceo está detrás de `spin`, que sale de `useReducedMotion()`. Emular
  `prefers-reduced-motion: no-preference` de tres maneras —antes de navegar,
  después, y pisando `matchMedia` con `addScriptToEvaluateOnNewDocument`— no
  alcanzó. `useFrame` corre (la transición del arrastre anima), pero todo lo que
  depende de `spin` queda quieto.
- `Emulation.setVirtualTimePolicy` tampoco sirve: hace avanzar el reloj de la
  página —comprobado con un marcador movido desde un rAF— pero
  `Page.captureScreenshot` devuelve la superficie vieja mientras el tiempo está
  pausado, aun con `--run-all-compositor-stages-before-draw`.

Lo que sí anima es la **transición del arrastre**, el gesto que la propia landing
sugiere. Se graba con `Page.startScreencast` a tiempo real (~30 fps) disparando
el arrastre en el medio, y se remuestrea a 30 fps buscando para cada instante el
cuadro grabado más cercano. Ver `work/capture-hero.mjs`.

## Caption

Una sola frase, concreta, sin «estamos felices de compartir».
