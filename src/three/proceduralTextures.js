import * as THREE from 'three'
import { seededRandom } from './storyMath'

/**
 * Texturas generadas por código en un canvas, en vez de descargadas.
 *
 * Un set PBR fotográfico pesa unos 2 MB por material y no se puede comprimir
 * más, lo que multiplicaría por treinta el peso de esta sección. Acá el costo
 * de red es cero: se dibujan al vuelo la primera vez que se usan.
 *
 * Los mapas de rugosidad se generan claros (cerca del blanco) porque three los
 * multiplica por el `roughness` del material. Así agregan variación sin pisar
 * los valores que ya tiene cada cuerpo.
 */

// 256 alcanza de sobra: todo se usa con repetición, así que cada baldosa
// ocupa pocos píxeles en pantalla. Bajarlo acelera el arranque.
const SIZE = 256

const createCanvas = (size = SIZE) => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

/** Ruido suave: se dibuja chico y se agranda, que interpola solo. */
function buildNoise(octaves, seed) {
  const canvas = createCanvas()
  const ctx = canvas.getContext('2d')
  const rng = seededRandom(seed)

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, SIZE, SIZE)

  octaves.forEach(({ cells, alpha }) => {
    const small = createCanvas(cells)
    const sctx = small.getContext('2d')
    const image = sctx.createImageData(cells, cells)
    for (let i = 0; i < cells * cells; i += 1) {
      const value = Math.floor(rng() * 256)
      image.data[i * 4] = value
      image.data[i * 4 + 1] = value
      image.data[i * 4 + 2] = value
      image.data[i * 4 + 3] = 255
    }
    sctx.putImageData(image, 0, 0)

    ctx.globalAlpha = alpha
    ctx.drawImage(small, 0, 0, SIZE, SIZE)
    ctx.globalAlpha = 1
  })

  return canvas
}

/** Deriva un normal map de un canvas de alturas, midiendo la pendiente. */
function heightToNormal(heightCanvas, strength = 2.2) {
  const source = heightCanvas
    .getContext('2d')
    .getImageData(0, 0, SIZE, SIZE).data

  const canvas = createCanvas()
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(SIZE, SIZE)

  // Envolvemos en los bordes para que la textura siga siendo repetible.
  const at = (x, y) =>
    source[((((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)) * 4] / 255

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength
      const ny = (at(x, y - 1) - at(x, y + 1)) * strength
      const length = Math.hypot(nx, ny, 1)
      const i = (y * SIZE + x) * 4
      image.data[i] = ((nx / length) * 0.5 + 0.5) * 255
      image.data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255
      image.data[i + 2] = (1 / length) * 0.5 * 255 + 127.5
      image.data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

function toTexture(canvas, { srgb = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Rugosidad clara con variación: multiplica al valor del material. */
function buildRoughness(noiseCanvas, amount = 0.28) {
  const canvas = createCanvas()
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.globalAlpha = amount
  ctx.drawImage(noiseCanvas, 0, 0)
  ctx.globalAlpha = 1
  return canvas
}

/**
 * Plástico reciclado: base sólida con motas de otros colores, que es lo que
 * más delata al material recuperado frente al plástico virgen.
 */
function buildPlastic({ base, flecks, seed }) {
  const noise = buildNoise(
    [
      { cells: 12, alpha: 0.55 },
      { cells: 48, alpha: 0.45 },
    ],
    seed,
  )

  const color = createCanvas()
  const ctx = color.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.3
  ctx.drawImage(noise, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  // Las mismas motas van al mapa de alturas, para que se sientan al tacto.
  const height = createCanvas()
  const hctx = height.getContext('2d')
  hctx.drawImage(noise, 0, 0)

  const rng = seededRandom(seed + 7)
  for (let i = 0; i < 700; i += 1) {
    const x = rng() * SIZE
    const y = rng() * SIZE
    const rx = 0.8 + rng() * 2.6
    const ry = 0.8 + rng() * 1.8
    const angle = rng() * Math.PI

    ctx.fillStyle = flecks[Math.floor(rng() * flecks.length)]
    ctx.globalAlpha = 0.4 + rng() * 0.5
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2)
    ctx.fill()

    const shade = Math.floor(90 + rng() * 120)
    hctx.fillStyle = `rgb(${shade},${shade},${shade})`
    hctx.globalAlpha = 0.7
    hctx.beginPath()
    hctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2)
    hctx.fill()
  }
  ctx.globalAlpha = 1
  hctx.globalAlpha = 1

  return {
    map: toTexture(color, { srgb: true }),
    roughnessMap: toTexture(buildRoughness(noise, 0.3)),
    normalMap: toTexture(heightToNormal(height, 1.6)),
  }
}

/**
 * Metal cepillado. Sin mapa de color: sólo relieve y rugosidad, para que cada
 * pieza conserve el gris que ya tenía y no se aplanen todas al mismo tono.
 */
function buildBrushedMetal(seed) {
  const noise = buildNoise([{ cells: 64, alpha: 0.5 }], seed)

  const height = createCanvas()
  const ctx = height.getContext('2d')
  ctx.drawImage(noise, 0, 0)

  // Rayas horizontales: en un cilindro la U da la vuelta, así que las marcas
  // quedan siguiendo la circunferencia, como una pieza torneada.
  const rng = seededRandom(seed + 3)
  for (let i = 0; i < 420; i += 1) {
    const y = rng() * SIZE
    const shade = Math.floor(70 + rng() * 130)
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`
    ctx.globalAlpha = 0.15 + rng() * 0.35
    ctx.lineWidth = 0.5 + rng() * 1.2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(SIZE, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  return {
    roughnessMap: toTexture(buildRoughness(height, 0.35)),
    normalMap: toTexture(heightToNormal(height, 1.1)),
  }
}

/** Madera para los postes: vetas siguiendo el eje del poste. */
function buildWood(seed) {
  const noise = buildNoise(
    [
      { cells: 8, alpha: 0.6 },
      { cells: 32, alpha: 0.4 },
    ],
    seed,
  )

  const color = createCanvas()
  const ctx = color.getContext('2d')
  ctx.fillStyle = '#6b533c'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const height = createCanvas()
  const hctx = height.getContext('2d')
  hctx.drawImage(noise, 0, 0)

  // En un cilindro la V va a lo largo del eje, así que las vetas son
  // verticales en la textura para correr a lo largo del poste.
  const rng = seededRandom(seed + 11)
  for (let i = 0; i < 150; i += 1) {
    const x = rng() * SIZE
    const width = 0.6 + rng() * 3.4
    const dark = rng() > 0.5
    ctx.fillStyle = dark ? '#4a3627' : '#7d6248'
    ctx.globalAlpha = 0.2 + rng() * 0.45
    ctx.fillRect(x, 0, width, SIZE)

    const shade = dark ? 70 : 180
    hctx.fillStyle = `rgb(${shade},${shade},${shade})`
    hctx.globalAlpha = 0.4
    hctx.fillRect(x, 0, width, SIZE)
  }
  ctx.globalAlpha = 1
  hctx.globalAlpha = 1

  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.35
  ctx.drawImage(noise, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  return {
    map: toTexture(color, { srgb: true }),
    roughnessMap: toTexture(buildRoughness(height, 0.4)),
    normalMap: toTexture(heightToNormal(height, 2.4)),
  }
}

/** Plástico de botella: casi liso, con un relieve muy suave que atrapa la luz. */
function buildBottlePlastic(seed) {
  const noise = buildNoise([{ cells: 96, alpha: 0.35 }], seed)

  return {
    roughnessMap: toTexture(buildRoughness(noise, 0.2)),
    normalMap: toTexture(heightToNormal(noise, 0.7)),
  }
}

// Se construyen una sola vez y se comparten. Cada uso clona para poder fijar
// su propia repetición sin afectar a los demás.
const cache = new Map()
const memo = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}

/*
  Gris oscuro mate, tipo caucho: es el color real del plástico reciclado, que
  sale de mezclar material de orígenes distintos. Las motas se mantienen cerca
  del tono base, apenas más claras y más oscuras, para que se lean como
  variación del propio material y no como confeti de colores.
*/
export const rodPlasticMaps = () =>
  memo('rod', () =>
    buildPlastic({
      base: '#3a3833',
      flecks: ['#4d4a43', '#2a2825', '#5b564a', '#403d36', '#6a6456'],
      seed: 4821,
    }),
  )

export const bottlePlasticMaps = () => memo('bottle', () => buildBottlePlastic(1307))
export const metalMaps = () => memo('metal', () => buildBrushedMetal(2645))
export const woodMaps = () => memo('wood', () => buildWood(9133))

/** Clona un juego de mapas con su propia repetición. */
export function repeated(maps, x, y) {
  const out = {}
  for (const key of Object.keys(maps)) {
    const texture = maps[key].clone()
    texture.repeat.set(x, y)
    texture.needsUpdate = true
    out[key] = texture
  }
  return out
}
