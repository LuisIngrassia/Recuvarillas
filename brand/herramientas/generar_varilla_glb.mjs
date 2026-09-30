/**
 * Rehace la geometría de `public/varilla.glb`: la punta y las perforaciones.
 *
 * El modelo original era una barra maciza de 3 × 3 × 120 cm, sin punta ni
 * agujeros. La varilla real tiene las dos cosas y el manual de marca la dibuja
 * así en todos lados (el logo, el separador, el gráfico de dimensiones), así
 * que el 3D de la web tiene que decir lo mismo.
 *
 * Qué hace:
 *   - La barra es un perfil extruido: el contorno de la varilla vista de
 *     costado, con los agujeros ya calados. Así los agujeros atraviesan de
 *     verdad y tienen pared adentro, sin operaciones booleanas.
 *   - La punta se afina en las dos direcciones (pirámide) en el extremo que va
 *     enterrado, sin cambiar el largo total: el visor centra la varilla por su
 *     caja, y si el largo cambiara los alambres dejarían de caer en los agujeros.
 *   - Los agujeros están a las alturas de los alambres de `src/three/RodViewer.jsx`
 *     (WIRE_HEIGHTS). Si se cambia una, hay que cambiar la otra.
 *   - La etiqueta se reimprime con la palabra del logo ("Recuvarilla", sin
 *     guion, como pide el manual) y pasa al extremo de arriba.
 *   - El material, la textura de relieve y las demás partes del archivo quedan
 *     como estaban. El GLB se edita a mano (JSON + binario) y no con una
 *     librería de glTF: la que se probó descartaba la extensión del relieve
 *     (EXT_materials_bump), que no es estándar.
 *
 * Uso, desde la raíz del repo:
 *   node brand/herramientas/generar_varilla_glb.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { Resvg } from '@resvg/resvg-js'

const BRAND = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REPO = path.dirname(BRAND)
const GLB = path.join(REPO, 'public', 'varilla.glb')

// Medidas del modelo, en metros. La varilla viene acostada sobre X.
const LARGO = 1.203
const LADO = 0.033
const X0 = -LARGO / 2 // extremo de abajo: ahí va la punta
const PUNTA = 0.06 // largo del tramo que se afina
const PUNTA_MIN = 0.004 // la punta no termina en un filo: se rompería
const BISEL = 0.0012 // canto redondeado, como el modelo original
/** Alturas de los alambres desde el centro (RodViewer.jsx, WIRE_HEIGHTS). */
const AGUJEROS = [-0.36, 0, 0.36]
const RADIO_AGUJERO = 0.0055

/**
 * La barra. El perfil se dibuja en el plano (x, z) de la varilla y se extruye
 * a lo alto (y), que es la dirección en la que la atraviesan los alambres.
 */
function barra() {
  const medio = LADO / 2
  const contorno = new THREE.Shape()
  contorno.moveTo(X0, -PUNTA_MIN / 2)
  contorno.lineTo(X0 + PUNTA, -medio)
  contorno.lineTo(-X0, -medio)
  contorno.lineTo(-X0, medio)
  contorno.lineTo(X0 + PUNTA, medio)
  contorno.lineTo(X0, PUNTA_MIN / 2)
  contorno.closePath()

  for (const x of AGUJEROS) {
    const agujero = new THREE.Path()
    agujero.absarc(x, 0, RADIO_AGUJERO, 0, Math.PI * 2, true)
    contorno.holes.push(agujero)
  }

  const geo = new THREE.ExtrudeGeometry(contorno, {
    depth: LADO - 2 * BISEL,
    bevelEnabled: true,
    bevelThickness: BISEL,
    bevelSize: BISEL,
    bevelOffset: -BISEL,
    bevelSegments: 2,
    curveSegments: 20,
  })

  // Extruida sobre z: se la gira para que la extrusión quede sobre y, y se la
  // apoya en y = 0..LADO como el modelo original.
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, BISEL, 0)

  // La punta también se afina a lo alto: sin esto sería un cincel, que de
  // frente no se ve en punta.
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    if (x >= X0 + PUNTA) continue
    const t = (x - X0) / PUNTA // 0 en la punta, 1 donde empieza a afinarse
    const escala = (PUNTA_MIN + (LADO - PUNTA_MIN) * t) / LADO
    pos.setY(i, medio + (pos.getY(i) - medio) * escala)
  }

  const plana = geo.index ? geo.toNonIndexed() : geo
  plana.computeVertexNormals()
  return plana
}

/** La etiqueta impresa: la palabra del logo en blanco, la medida y el código del PP. */
function etiqueta() {
  const leer = (archivo) => fs.readFileSync(path.join(BRAND, 'assets', archivo), 'utf8')
  const logo = leer('logo/recuvarilla-palabra-blanco.svg')
  const vb = logo.match(/viewBox="([^"]+)"/)[1]
  const cuerpo = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>.*?<\/title>/, '')

  // Mismo lienzo y misma zona útil que la etiqueta original: 4096 × 512, con
  // el texto en el 40% izquierdo. Va espejada de arriba abajo, igual que la
  // original: el exportador de three invierte la V de las texturas.
  const tinta = '#E8EBE9'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="512" viewBox="0 0 4096 512">
    <g transform="translate(0 512) scale(1 -1)">
      <svg x="90" y="150" width="1250" height="210" viewBox="${vb}" preserveAspectRatio="xMinYMid meet">${cuerpo.replaceAll('#FFFFFF', tinta)}</svg>
      <text x="92" y="470" font-family="Chivo Mono" font-weight="500" font-size="92" fill="${tinta}" letter-spacing="6">PP · 3 × 3 × 120 cm</text>
      <g transform="translate(1440 150)" fill="none" stroke="${tinta}" stroke-width="16">
        <path d="M0 250 L115 30 L230 250 Z" stroke-linejoin="miter"/>
        <text x="115" y="215" text-anchor="middle" font-family="Chivo Mono" font-weight="500" font-size="120" fill="${tinta}" stroke="none">5</text>
        <text x="115" y="330" text-anchor="middle" font-family="Chivo Mono" font-weight="500" font-size="80" fill="${tinta}" stroke="none">PP</text>
      </g>
    </g>
  </svg>`

  const png = new Resvg(svg, {
    background: 'rgba(0,0,0,0)',
    font: {
      fontFiles: [
        path.join(BRAND, 'assets', 'fonts', 'instalar', 'ChivoMono-Medium.ttf'),
      ],
      loadSystemFonts: false,
      defaultFontFamily: 'Chivo Mono',
    },
  })
    .render()
    .asPng()
  return new Uint8Array(png)
}

/** Lee un GLB: el JSON y el bloque binario. */
function leerGlb(archivo) {
  const b = fs.readFileSync(archivo)
  const largoJson = b.readUInt32LE(12)
  const json = JSON.parse(b.subarray(20, 20 + largoJson).toString('utf8'))
  const bin = b.subarray(20 + largoJson + 8)
  return { json, bin }
}

/** Arma el GLB de nuevo, copiando sólo los tramos del binario que se usan. */
function escribirGlb(archivo, json, bloques) {
  const partes = []
  let offset = 0
  json.bufferViews = bloques.map(({ datos, target }) => {
    const vista = { buffer: 0, byteOffset: offset, byteLength: datos.byteLength }
    if (target) vista.target = target
    partes.push(Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength))
    const relleno = (4 - (datos.byteLength % 4)) % 4
    if (relleno) partes.push(Buffer.alloc(relleno))
    offset += datos.byteLength + relleno
    return vista
  })
  json.buffers = [{ byteLength: offset }]

  let textoJson = Buffer.from(JSON.stringify(json), 'utf8')
  const rellenoJson = (4 - (textoJson.length % 4)) % 4
  textoJson = Buffer.concat([textoJson, Buffer.alloc(rellenoJson, 0x20)])
  const bin = Buffer.concat(partes)

  const cabecera = Buffer.alloc(12)
  cabecera.writeUInt32LE(0x46546c67, 0)
  cabecera.writeUInt32LE(2, 4)
  cabecera.writeUInt32LE(12 + 8 + textoJson.length + 8 + bin.length, 8)
  const trozo = (largo, tipo) => {
    const h = Buffer.alloc(8)
    h.writeUInt32LE(largo, 0)
    h.writeUInt32LE(tipo, 4)
    return h
  }
  fs.writeFileSync(
    archivo,
    Buffer.concat([cabecera, trozo(textoJson.length, 0x4e4f534a), textoJson, trozo(bin.length, 0x004e4942), bin]),
  )
}

const { json, bin } = leerGlb(GLB)
const nodo = (nombre) => json.nodes.find((n) => n.name === nombre)
const barraNodo = nodo('bar')
const etiquetaNodo = nodo('label')
if (!barraNodo || !etiquetaNodo) throw new Error('El GLB no tiene los nodos "bar" y "label" esperados.')

/*
  Cada bufferView viejo se vuelve un bloque; los accesores y las imágenes pasan
  a apuntar al bloque nuevo. Los de la barra vieja se reemplazan y quedan sin
  uso, así que no se copian.
*/
const bloques = []
const bloqueDe = new Map()
const usar = (indiceVista) => {
  if (!bloqueDe.has(indiceVista)) {
    const v = json.bufferViews[indiceVista]
    const inicio = v.byteOffset ?? 0
    bloqueDe.set(indiceVista, bloques.length)
    bloques.push({ datos: bin.subarray(inicio, inicio + v.byteLength), target: v.target })
  }
  return bloqueDe.get(indiceVista)
}
const agregar = (datos, target) => bloques.push({ datos, target }) - 1

const geo = barra()
const prim = json.meshes[barraNodo.mesh].primitives[0]
const viejos = new Set(Object.values(prim.attributes))
if (prim.indices !== undefined) viejos.add(prim.indices)

const nuevoAccesor = (arreglo, tipo, conCaja) => {
  const componentes = { VEC2: 2, VEC3: 3 }[tipo]
  const accesor = {
    bufferView: agregar(new Float32Array(arreglo), 34962),
    componentType: 5126,
    count: arreglo.length / componentes,
    type: tipo,
  }
  if (conCaja) {
    const min = Array(componentes).fill(Infinity)
    const max = Array(componentes).fill(-Infinity)
    for (let i = 0; i < arreglo.length; i++) {
      const c = i % componentes
      min[c] = Math.min(min[c], arreglo[i])
      max[c] = Math.max(max[c], arreglo[i])
    }
    Object.assign(accesor, { min, max })
  }
  return json.accessors.push(accesor) - 1
}

// Primero se reubican los accesores que siguen en uso, después se agregan los nuevos.
json.accessors.forEach((accesor, i) => {
  if (!viejos.has(i)) accesor.bufferView = usar(accesor.bufferView)
})
json.images.forEach((imagen) => {
  imagen.bufferView = usar(imagen.bufferView)
})

prim.attributes = {
  POSITION: nuevoAccesor(geo.attributes.position.array, 'VEC3', true),
  NORMAL: nuevoAccesor(geo.attributes.normal.array, 'VEC3'),
  TEXCOORD_0: nuevoAccesor(geo.attributes.uv.array, 'VEC2'),
}
delete prim.indices

// La etiqueta: reimpresa con la marca nueva y al extremo de arriba (x positivo).
const texturaEtiqueta = json.materials[json.meshes[etiquetaNodo.mesh].primitives[0].material]
  .pbrMetallicRoughness.baseColorTexture.index
json.images[json.textures[texturaEtiqueta].source].bufferView = agregar(etiqueta())
etiquetaNodo.matrix[12] = 0.513

// Los accesores de la barra vieja se sacan y se renumeran las referencias.
const renumero = new Map()
json.accessors = json.accessors.filter((_, i) => {
  if (viejos.has(i)) return false
  renumero.set(i, renumero.size)
  return true
})
for (const mesh of json.meshes) {
  for (const p of mesh.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = renumero.get(p.attributes[k])
    if (p.indices !== undefined) p.indices = renumero.get(p.indices)
  }
}

json.asset.generator = 'Recuvarilla · brand/herramientas/generar_varilla_glb.mjs'
escribirGlb(GLB, json, bloques)

const caja = new THREE.Box3().setFromBufferAttribute(geo.attributes.position)
console.log(
  `varilla.glb listo · ${geo.attributes.position.count} vértices · caja`,
  caja.min.toArray().map((v) => v.toFixed(4)).join(','),
  '→',
  caja.max.toArray().map((v) => v.toFixed(4)).join(','),
)
