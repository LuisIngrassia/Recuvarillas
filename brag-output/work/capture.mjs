/**
 * Captura los cuadros del video manejando el Chrome que ya está en la máquina.
 *
 * Por CDP directo y no con Playwright o Puppeteer: Node 22 trae WebSocket
 * nativo, así que esto no instala nada ni toca el package.json del proyecto.
 *
 *   node capture.mjs             -> los 600 cuadros a frames/
 *   node capture.mjs 0.5 3.2 12  -> sólo esos tiempos, a stills/ (para revisar)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const W = 1920
const H = 1080
const FPS = 30
/* Puerto al azar: corriendo dos veces seguidas, el Chrome anterior todavía
   tiene tomado el que acaba de dejar y el nuevo se conecta al que se muere. */
const PUERTO = 9200 + Math.floor(Math.random() * 600)

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p))

if (!CHROME) throw new Error('No encontré Chrome.')

const stills = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n))
const destino = path.join(AQUI, stills.length ? 'stills' : 'frames')
fs.rmSync(destino, { recursive: true, force: true })
fs.mkdirSync(destino, { recursive: true })

const perfil = path.join(AQUI, `chrome-profile-${PUERTO}`)
const pagina = 'file:///' + path.join(AQUI, 'scene.html').replace(/\\/g, '/')

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  pagina,
], { stdio: 'ignore' })

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Espera a que Chrome levante y devuelva el target **de nuestra página**.
 *
 * Filtrar por la URL y no agarrar el primer target de tipo `page` es lo único
 * que importa acá: al arrancar hay un instante en que el único que figura es el
 * `about:blank` inicial. Conectarse a ése no da error —`window.ready` sobre
 * `undefined` resuelve contento— y recién se nota cuadros más adelante, cuando
 * `setTime` no existe o cuando la foto sale vacía.
 */
async function buscarPagina() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
      const p = lista.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl && t.url.includes('scene.html'),
      )
      if (p) return p
    } catch {
      /* todavía no abrió el puerto */
    }
    await dormir(120)
  }
  throw new Error('Chrome no abrió la página de la escena.')
}

const objetivo = await buscarPagina()
const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
await new Promise((r, x) => {
  ws.onopen = r
  ws.onerror = () => x(new Error('No pude conectarme a Chrome.'))
})

let id = 0
const esperando = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && esperando.has(m.id)) {
    const { ok, fail } = esperando.get(m.id)
    esperando.delete(m.id)
    m.error ? fail(new Error(m.error.message)) : ok(m.result)
  }
}

const cdp = (method, params = {}) =>
  new Promise((ok, fail) => {
    id += 1
    esperando.set(id, { ok, fail })
    ws.send(JSON.stringify({ id, method, params }))
  })

/**
 * Evalúa en la página y revienta si el JS tiró una excepción.
 *
 * `Runtime.evaluate` no falla cuando el código de la página falla: devuelve el
 * error adentro de `exceptionDetails` y sigue como si nada. Sin esto, un error
 * en `setTime` deja la página congelada y se guardan 600 cuadros negros sin que
 * nada lo diga hasta que uno los mira.
 */
async function evaluar(expression, extra = {}) {
  const r = await cdp('Runtime.evaluate', { expression, ...extra })
  if (r.exceptionDetails) {
    const e = r.exceptionDetails
    throw new Error(
      `JS en la página: ${e.exception?.description ?? e.text}\n  en ${expression.slice(0, 80)}`,
    )
  }
  return r
}

await cdp('Page.enable')
await cdp('Runtime.enable')
/* Sin esto el alto del viewport lo decide la ventana del sistema y los cuadros
   salen con unos píxeles de más o de menos. */
await cdp('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: 1, mobile: false,
})

/*
  Que el target exista no quiere decir que su script ya haya corrido: el
  documento puede estar todavía parseándose. Y `Runtime.evaluate` sobre algo que
  no existe no falla —`window.ready` devuelve `undefined` y `awaitPromise` lo
  acepta feliz— así que el error recién aparece un par de llamadas después,
  lejos de su causa. Se espera a que la función exista.
*/
for (let i = 0; ; i += 1) {
  const { result } = await evaluar('typeof window.setTime')
  if (result.value === 'function') break
  if (i > 100) throw new Error('La página nunca definió setTime.')
  await dormir(100)
}

/* Las imágenes y las fuentes tienen que estar antes del primer cuadro: si no,
   los primeros salen en blanco y el video arranca con un parpadeo. */
await evaluar('window.ready', { awaitPromise: true })

const { result: dur } = await evaluar('window.DURATION')
const total = Math.round(dur.value * FPS)
const tiempos = stills.length ? stills : Array.from({ length: total }, (_, i) => i / FPS)

process.stdout.write(`${tiempos.length} cuadros → ${path.basename(destino)}\n`)
const arranque = Date.now()

for (let i = 0; i < tiempos.length; i += 1) {
  const t = tiempos[i]
  /* `awaitPromise` porque `setTime` devuelve la decodificación del cuadro de
     hero cuando toca cargarlo. Sin esperarla, esa foto sale con el cuadro
     anterior. */
  await evaluar(`setTime(${t})`, { awaitPromise: true })

  /*
    Dos rAF antes de la foto.

    `captureScreenshot` no espera a que se componga lo que acaba de cambiar, y
    una escena que pasa de `display:none` a visible necesita layout y pintado.
    Sin esta espera sale un cuadro negro cada tanto —intermitente, que es la
    peor clase de error: en una prueba de cinco cuadros aparece una vez y en el
    render de seiscientos quedan repartidos sin que nadie los vea hasta el
    final. El primer rAF cae en el cuadro que se está armando; el segundo
    garantiza que ese ya se compuso.
  */
  await evaluar('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))',
    { awaitPromise: true })

  const { data } = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true })

  const nombre = stills.length
    ? `t-${t.toFixed(2).replace('.', '_')}.png`
    : `f-${String(i).padStart(4, '0')}.png`
  fs.writeFileSync(path.join(destino, nombre), Buffer.from(data, 'base64'))

  if (!stills.length && i % 60 === 0) {
    const seg = (Date.now() - arranque) / 1000
    process.stdout.write(`  ${i}/${tiempos.length}  ${seg.toFixed(0)}s\n`)
  }
}

process.stdout.write(`listo en ${((Date.now() - arranque) / 1000).toFixed(0)}s\n`)
ws.close()
chrome.kill()
/* Chrome deja el perfil abierto un instante; sin la espera, el rmSync falla. */
await dormir(400)
fs.rmSync(perfil, { recursive: true, force: true })
process.exit(0)
