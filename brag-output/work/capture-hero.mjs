/**
 * Graba el hero real de la landing, con su animación.
 *
 * Dos cosas no salieron y conviene que queden escritas, porque parecen
 * caminos obvios y no lo son:
 *
 * 1. **El tiempo virtual no sirve acá.** `Emulation.setVirtualTimePolicy` hace
 *    avanzar el reloj de la página —lo comprobé con un marcador movido desde un
 *    rAF— pero `Page.captureScreenshot` sigue devolviendo la superficie vieja
 *    mientras el tiempo está pausado. Ni `--run-all-compositor-stages-before-draw`
 *    ni `--disable-new-content-rendering-timeout` lo cambian.
 * 2. **El meceo del alambrado no ocurre en headless.** Está detrás de `spin`,
 *    que sale de `prefers-reduced-motion`. Emularlo de tres formas distintas y
 *    hasta pisar `matchMedia` antes de que cargue la app no alcanzó: `useFrame`
 *    corre (la transición del arrastre anima), pero lo que depende de `spin`
 *    queda quieto.
 *
 * Lo que sí anima, y es mejor toma: **la transición del arrastre**. Es el gesto
 * que la propia landing sugiere —"Arrastrá para ver una varilla en detalle"— y
 * en él el alambrado se abre y queda una sola varilla en primer plano. Así que
 * se graba a tiempo real con `Page.startScreencast` y se dispara el arrastre en
 * el medio.
 *
 * Los cuadros llegan a ~19 fps con SwiftShader y con su marca de tiempo, así
 * que después se remuestrean a los 30 fps del video.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const W = 1920
const H = 1080
const FPS = 30
const DUR_CLIP = 3.4          // cuánto hero entra en el video
const PUERTO = 9600 + Math.floor(Math.random() * 300)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const destino = path.join(AQUI, 'hero')
fs.rmSync(destino, { recursive: true, force: true })
fs.mkdirSync(destino, { recursive: true })

const perfil = path.join(AQUI, `hero-profile-${PUERTO}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check',
  /* Sin `--disable-gpu`: apagarlo se lleva puesto WebGL. SwiftShader es el
     rasterizador por software que lo hace andar sin placa. */
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  'about:blank',
], { stdio: 'ignore' })

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let obj = null
for (let i = 0; i < 150; i += 1) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
    obj = l.find((t) => t.type === 'page')
    if (obj) break
  } catch { /* todavía no abrió */ }
  await dormir(150)
}
if (!obj) throw new Error('Chrome no abrió. ¿Está corriendo `vite preview` en 4173?')

const ws = new WebSocket(obj.webSocketDebuggerUrl)
await new Promise((r) => { ws.onopen = r })

let id = 0
const pend = new Map()
const cuadros = []
let grabando = false
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  if (m.method === 'Page.screencastFrame') {
    if (grabando) cuadros.push({ t: m.params.metadata.timestamp, data: m.params.data })
    /* Hay que acusar recibo o Chrome deja de mandar cuadros. */
    ws.send(JSON.stringify({
      id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId },
    }))
  }
}
const cdp = (me, pa = {}) =>
  new Promise((ok) => { id += 1; pend.set(id, ok); ws.send(JSON.stringify({ id, method: me, params: pa })) })
const evaluar = async (x) =>
  (await cdp('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value

await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Emulation.enable')
await cdp('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: 1, mobile: false,
})

process.stdout.write('cargando la landing…\n')
await cdp('Page.navigate', { url: 'http://localhost:4173/' })
/* A tiempo real: bajar three, el .glb y compilar los shaders. Con SwiftShader
   tarda bastante más que con placa. */
await dormir(13000)

/* El hero ocupa la pantalla entera: se esconde lo que viene abajo para que no
   se asome la sección de productos. La barra de navegación se queda, porque es
   parte de lo que se muestra: es el sitio, no una maqueta. */
process.stdout.write(`${await evaluar(`(() => {
  const h = document.querySelector('#inicio')
  if (!h) return 'sin hero'
  for (let n = h.nextElementSibling; n; n = n.nextElementSibling) n.style.display = 'none'
  h.style.minHeight = '100vh'
  scrollTo(0, 0)
  return h.querySelector('canvas') ? 'hero listo' : 'sin canvas'
})()`)}\n`)
await dormir(2500)

await cdp('Page.startScreencast', {
  format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1,
})
grabando = true

/* Un momento de alambrado quieto antes del gesto: la toma necesita asentarse
   para que después se lea el cambio. */
await dormir(1300)

/*
  El arrastre, de a pasos y sobre el canvas. Un solo salto de punta a punta no
  lo lee como gesto: hace falta la secuencia presionar · mover · soltar.
*/
const X = 1300, Y = 520
await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: X, y: Y, button: 'left', clickCount: 1, buttons: 1 })
for (let i = 1; i <= 12; i += 1) {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: X - i * 22, y: Y + i * 3, button: 'left', buttons: 1 })
  await dormir(28)
}
await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: X - 264, y: Y + 36, button: 'left', buttons: 0 })

/* Y lo que dura la transición hasta que queda la varilla sola. */
await dormir(3400)

grabando = false
await cdp('Page.stopScreencast')
await dormir(300)

if (cuadros.length < 10) throw new Error(`Sólo llegaron ${cuadros.length} cuadros.`)

const t0 = cuadros[0].t
const span = cuadros[cuadros.length - 1].t - t0
process.stdout.write(
  `grabados ${cuadros.length} cuadros en ${span.toFixed(2)}s (${(cuadros.length / span).toFixed(1)} fps)\n`,
)

/*
  Remuestreo a 30 fps.

  El screencast entrega cuando puede, no a intervalos parejos, así que para cada
  instante del video se busca el cuadro grabado más cercano en el tiempo. Se
  repite alguno —a 19 fps de origen es inevitable— pero el movimiento queda a la
  velocidad real en vez de acelerado o a los tirones.
*/
const total = Math.round(DUR_CLIP * FPS)
/*
  La ventana arranca un toque antes del arrastre, no al final de la grabación:
  lo que hay que mostrar es el cambio, no el estado al que llega. El gesto se
  dispara 1,3 s después de empezar a grabar.
*/
const desde = Math.max(0, Math.min(0.9, span - DUR_CLIP))
for (let i = 0; i < total; i += 1) {
  const objetivo = desde + (i / FPS)
  let mejor = 0
  let dist = Infinity
  for (let k = 0; k < cuadros.length; k += 1) {
    const d = Math.abs((cuadros[k].t - t0) - objetivo)
    if (d < dist) { dist = d; mejor = k }
  }
  fs.writeFileSync(
    path.join(destino, `h-${String(i).padStart(3, '0')}.jpg`),
    Buffer.from(cuadros[mejor].data, 'base64'),
  )
}

process.stdout.write(`${total} cuadros de hero a ${FPS} fps → hero/\n`)
ws.close(); chrome.kill(); await dormir(600)
fs.rmSync(perfil, { recursive: true, force: true })
process.exit(0)
