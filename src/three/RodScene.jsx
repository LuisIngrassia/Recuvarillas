import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, lerp, seededRandom, stage } from './storyMath'
import { CHAPTER_RANGES as CHAPTERS } from '../data/storyChapters'
import {
  bottlePlasticMaps,
  metalMaps,
  repeated,
  rodPlasticMaps,
  woodMaps,
} from './proceduralTextures'

// La varilla real mide 3 x 3 x 120 cm: una proporción de 1 a 40.
// Fijamos el largo en unidades de escena y derivamos el lado de ahí.
const ROD_LENGTH = 5
const ROD_SIDE = ROD_LENGTH * (3 / 120)

// Una botella de 500 ml mide ~22 cm. Modelamos una de 0,965 de alto y la
// escalamos para que quede en proporción real contra la varilla.
const BOTTLE_HEIGHT = ROD_LENGTH * (22 / 120)
const BOTTLE_MODEL_HEIGHT = 0.965
const BOTTLE_SCALE = BOTTLE_HEIGHT / BOTTLE_MODEL_HEIGHT

// Disposición de la máquina, de izquierda a derecha: tolva, cañón, molde.
const HOPPER_X = -3.6
const HOPPER_TOP_Y = 2.4
const HOPPER_THROAT_Y = 0.55
const BARREL_START_X = -4.6
const BARREL_END_X = -1.1
const BARREL_LENGTH = BARREL_END_X - BARREL_START_X
const MOLD_X = -0.7
const MOLD_FACE_X = -0.3

const HOLE_HEIGHTS = [1, 2, 3, 4]

/**
 * Cuántas veces se repite la textura a lo largo de la varilla. Con la
 * proporción 1:40 una repetición cuadrada daría 40 baldosas diminutas, así que
 * usamos menos y quedan estiradas a lo largo: es justo lo que le pasa a las
 * motas de un material extruido, que se alargan en el sentido del flujo.
 */
const ROD_TILES = 16

/**
 * Hace crecer un objeto sobre su eje local Y.
 *
 * Es importante apagar `visible`: escalar sólo en Y deja el objeto con su
 * ancho completo, así que un valor de 0 no lo oculta, lo aplasta en un disco
 * que se ve igual. Por eso todo lo que crece pasa por acá.
 */
const growY = (object, value) => {
  object.visible = value > 0.002
  object.scale.y = Math.max(value, 0.0001)
}

/** Botella de plástico armada con primitivas: cuerpo, hombro, pico y tapa. */
function Bottle({ tint }) {
  // Sólo relieve y rugosidad: un mapa de color pelearía con la transparencia.
  const skin = useMemo(() => repeated(bottlePlasticMaps(), 3, 2), [])
  const cap = useMemo(() => repeated(bottlePlasticMaps(), 2, 1), [])

  return (
    <group scale={BOTTLE_SCALE}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.6, 20]} />
        <meshStandardMaterial
          {...skin}
          normalScale={[0.35, 0.35]}
          color={tint}
          roughness={0.15}
          metalness={0}
          transparent
          opacity={0.75}
        />
      </mesh>
      <mesh position={[0, 0.69, 0]}>
        <cylinderGeometry args={[0.09, 0.22, 0.18, 20]} />
        <meshStandardMaterial
          {...skin}
          normalScale={[0.35, 0.35]}
          color={tint}
          roughness={0.15}
          transparent
          opacity={0.75}
        />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
        <meshStandardMaterial
          {...skin}
          color={tint}
          roughness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0, 0.93, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.07, 16]} />
        <meshStandardMaterial {...cap} color="#35610e" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Las botellas flotan, caen a la tolva de a una y desaparecen en la garganta. */
function Bottles({ progressRef }) {
  const groupRef = useRef(null)

  const bottles = useMemo(() => {
    const random = seededRandom(90210)
    const tints = ['#bfe3f7', '#c9e6b8', '#dceef8', '#a9d4ee']

    return [-1.15, -0.4, 0.4, 1.15].map((offset, index) => ({
      key: index,
      origin: [
        HOPPER_X + offset,
        HOPPER_TOP_Y + 0.9 + (random() - 0.5) * 0.8,
        (random() - 0.5) * 0.9,
      ],
      spin: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      tint: tints[index],
    }))
  }, [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const progress = progressRef.current
    const time = state.clock.elapsedTime
    const appear = stage(progress, 0, 0.04)

    group.children.forEach((bottle, index) => {
      const data = bottles[index]
      const [ox, oy, oz] = data.origin

      // La caída arranca antes de que termine el capítulo 1 para que se vea
      // venir, y cada botella entra un poco después que la anterior.
      const delay = index * 0.022
      const fall = stage(progress, 0.09 + delay, 0.2 + delay)

      const float = Math.sin(time * 0.9 + data.phase) * 0.12
      // Primero se alinean sobre la boca, después bajan por la garganta.
      const align = clamp01(fall * 2)

      bottle.position.set(
        lerp(ox, HOPPER_X, align),
        lerp(oy + float, HOPPER_THROAT_Y, fall),
        lerp(oz, 0, align),
      )
      bottle.rotation.y = data.spin + time * 0.4
      bottle.rotation.z = lerp(Math.sin(time * 0.7 + data.phase) * 0.25, 0, align)

      // Se achican al final del recorrido: es cuando entran en el triturador.
      const swallow = clamp01((fall - 0.72) / 0.28)
      bottle.scale.setScalar(Math.max(appear * (1 - swallow), 0.0001))
    })
  })

  return (
    <group ref={groupRef}>
      {bottles.map((bottle) => (
        <group key={bottle.key}>
          <Bottle tint={bottle.tint} />
        </group>
      ))}
    </group>
  )
}

/** Tolva: el embudo por donde entran las botellas. */
function Hopper() {
  const height = HOPPER_TOP_Y - HOPPER_THROAT_Y
  const cone = useMemo(() => repeated(metalMaps(), 6, 2), [])
  const throat = useMemo(() => repeated(metalMaps(), 3, 1), [])

  return (
    <group position={[HOPPER_X, 0, 0]}>
      <mesh position={[0, HOPPER_THROAT_Y + height / 2, 0]}>
        <cylinderGeometry args={[1.1, 0.28, height, 28, 1, true]} />
        <meshStandardMaterial
          {...cone}
          color="#78828c"
          roughness={0.35}
          metalness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Garganta que baja hasta el cañón. */}
      <mesh position={[0, HOPPER_THROAT_Y / 2 + 0.1, 0]}>
        <cylinderGeometry args={[0.28, 0.28, HOPPER_THROAT_Y, 20]} />
        <meshStandardMaterial
          {...throat}
          color="#5b6570"
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>
    </group>
  )
}

/**
 * Cañón de la extrusora: un tubo cerrado con bandas calefactoras.
 *
 * Para poder ver el plástico fundido por dentro lo dibujamos seccionado, como
 * un corte técnico: la mitad que da a la cámara está abierta y el resto (piso,
 * fondo y techo) es sólido, así se lee como una máquina cerrada y no como aros
 * sueltos en el aire.
 */
function Barrel({ progressRef }) {
  const flowRef = useRef(null)
  const materialRef = useRef(null)

  useFrame((state) => {
    const flow = flowRef.current
    const material = materialRef.current
    if (!flow || !material) return

    const progress = progressRef.current
    const time = state.clock.elapsedTime
    const fill = stage(progress, CHAPTERS.melt[0], CHAPTERS.melt[1])
    const cool = stage(progress, CHAPTERS.drill[0] - 0.04, CHAPTERS.drill[0] + 0.06)

    growY(flow, fill)
    material.emissiveIntensity = fill * (1 - cool) * (1.5 + Math.sin(time * 3) * 0.18)
  })

  // Las bandas van después de la tolva, que entra al cañón a 1.0 del inicio.
  const bands = [1.5, 2.05, 2.6, 3.15]
  const shell = useMemo(() => repeated(metalMaps(), 8, 3), [])
  const ring = useMemo(() => repeated(metalMaps(), 6, 1), [])

  return (
    <group position={[BARREL_START_X, 0, 0]}>
      {/* Rotamos -90° en Z para que el eje local +Y apunte hacia +X. */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        <group ref={flowRef}>
          <mesh position={[0, BARREL_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.24, 0.24, BARREL_LENGTH, 20]} />
            <meshStandardMaterial
              ref={materialRef}
              color="#c2601a"
              emissive="#ff9d3c"
              emissiveIntensity={0}
              roughness={0.3}
            />
          </mesh>
        </group>
      </group>

      {/*
        Carcasa seccionada. El ángulo theta del cilindro arranca en +Z (la
        cámara), así que dibujamos de PI/2 a 3PI/2: queda abierta justo del
        lado que miramos.
      */}
      <mesh position={[BARREL_LENGTH / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry
          args={[0.34, 0.34, BARREL_LENGTH, 32, 1, true, Math.PI / 2, Math.PI]}
        />
        <meshStandardMaterial
          {...shell}
          color="#6b747d"
          roughness={0.4}
          metalness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bridas de los extremos: cierran el tubo contra la tolva y el molde. */}
      {[0, BARREL_LENGTH].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.35, 0.055, 12, 30]} />
          <meshStandardMaterial
            {...ring}
            color="#3a4149"
            roughness={0.35}
            metalness={0.9}
          />
        </mesh>
      ))}

      {/* Bandas calefactoras abrazando el tubo. */}
      {bands.map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.39, 0.085, 12, 30]} />
          <meshStandardMaterial
            {...ring}
            color="#454d56"
            roughness={0.4}
            metalness={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Molde de varillas: el plástico entra por un lado y sale perfilado por el otro. */
function Mold({ progressRef }) {
  const materialRef = useRef(null)
  const housing = useMemo(() => repeated(metalMaps(), 2, 2), [])

  useFrame(() => {
    const material = materialRef.current
    if (!material) return

    const progress = progressRef.current
    const working = stage(progress, CHAPTERS.mold[0] - 0.04, CHAPTERS.mold[0] + 0.06)
    const done = stage(progress, CHAPTERS.mold[1] - 0.02, CHAPTERS.mold[1] + 0.06)
    material.emissiveIntensity = working * (1 - done) * 1.2
  })

  return (
    <group position={[MOLD_X, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.8, 1.05, 1.05]} />
        <meshStandardMaterial
          {...housing}
          color="#3a4149"
          roughness={0.35}
          metalness={0.9}
        />
      </mesh>
      {/* Boca del molde: la sección cuadrada que define la varilla. */}
      <mesh position={[0.41, 0, 0]}>
        <boxGeometry args={[0.04, ROD_SIDE * 1.9, ROD_SIDE * 1.9]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#1a1d21"
          emissive="#ff9d3c"
          emissiveIntensity={0}
        />
      </mesh>
    </group>
  )
}

/**
 * La varilla: sale del molde en horizontal, se perfora y al final rota a
 * vertical para entrar en la cerca.
 */
function Rod({ progressRef }) {
  const groupRef = useRef(null)
  const bodyRef = useRef(null)
  const holesRef = useRef(null)
  const materialRef = useRef(null)
  const skin = useMemo(() => repeated(rodPlasticMaps(), 1, ROD_TILES), [])

  useFrame(() => {
    const group = groupRef.current
    const body = bodyRef.current
    const holes = holesRef.current
    const material = materialRef.current
    if (!group || !body || !holes || !material) return

    const progress = progressRef.current
    const extrude = stage(progress, CHAPTERS.mold[0], CHAPTERS.mold[1])
    const drill = stage(progress, CHAPTERS.drill[0], CHAPTERS.drill[1])
    const place = stage(progress, CHAPTERS.fence[0], CHAPTERS.fence[1])

    // Crece a lo largo de su eje, empujada por el molde.
    growY(body, extrude)

    /*
      Escalar el grupo NO escala las UV, así que sin esto la textura saldría
      comprimida del molde y se estiraría a medida que la varilla crece. Al
      atar la repetición al mismo factor, el grano queda fijo y lo que se ve
      es la varilla saliendo, no la textura desenrollándose.
    */
    const tiles = Math.max(ROD_TILES * extrude, 0.001)
    skin.map.repeat.y = tiles
    skin.roughnessMap.repeat.y = tiles
    skin.normalMap.repeat.y = tiles

    // Sale caliente y se va enfriando hasta el verde final.
    material.emissiveIntensity = (1 - stage(progress, CHAPTERS.mold[1] - 0.06, CHAPTERS.drill[0])) * extrude * 0.9

    // Pivotea sobre su base hasta quedar vertical y se centra en la cerca.
    group.rotation.z = lerp(-Math.PI / 2, 0, place)
    group.position.x = lerp(MOLD_FACE_X, 0, place)
    group.position.y = lerp(0, -ROD_LENGTH / 2, place)

    holes.children.forEach((hole, index) => {
      const local = clamp01(drill * HOLE_HEIGHTS.length - index)
      hole.scale.setScalar(Math.max(local, 0.0001))
    })
  })

  return (
    <group ref={groupRef} position={[MOLD_FACE_X, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <group ref={bodyRef}>
        <mesh position={[0, ROD_LENGTH / 2, 0]} castShadow>
          <boxGeometry args={[ROD_SIDE, ROD_LENGTH, ROD_SIDE]} />
          <meshStandardMaterial
            ref={materialRef}
            {...skin}
            normalScale={[0.6, 0.6]}
            emissive="#ff8a2b"
            emissiveIntensity={0}
            roughness={0.92}
            metalness={0}
          />
        </mesh>
      </group>

      {/* Perforaciones sobre el eje local X: por ahí pasan después los alambres. */}
      <group ref={holesRef}>
        {HOLE_HEIGHTS.map((height) => (
          <mesh key={height} position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, ROD_SIDE * 1.6, 12]} />
            <meshStandardMaterial color="#14130f" roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Mechas que bajan a perforar la varilla, una por agujero. */
function Drills({ progressRef }) {
  const groupRef = useRef(null)
  const steel = useMemo(() => repeated(metalMaps(), 2, 1), [])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const progress = progressRef.current
    const drill = stage(progress, CHAPTERS.drill[0], CHAPTERS.drill[1])
    const retire = stage(progress, CHAPTERS.drill[1] - 0.02, CHAPTERS.fence[0])

    group.children.forEach((bit, index) => {
      const local = clamp01(drill * HOLE_HEIGHTS.length - index)
      // Baja, toca la varilla y vuelve a subir.
      const plunge = Math.sin(local * Math.PI)
      bit.position.y = lerp(0.85, 0.16, plunge)
      bit.visible = local > 0.002 && retire < 0.998
      bit.scale.setScalar(Math.max(1 - retire, 0.0001))
    })
  })

  return (
    <group ref={groupRef}>
      {HOLE_HEIGHTS.map((height) => (
        <group key={height} position={[MOLD_FACE_X + height, 0.85, 0]}>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.45, 12]} />
            <meshStandardMaterial
              {...steel}
              color="#454d56"
              roughness={0.35}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <coneGeometry args={[0.045, 0.22, 12]} />
            <meshStandardMaterial color="#a6adb4" roughness={0.25} metalness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Postes y alambres del cierre. */
function Fence({ progressRef }) {
  const postsRef = useRef(null)
  const wiresRef = useRef(null)
  // La V del cilindro va a lo largo del poste, así que una sola repetición
  // vertical deja la veta corrida de punta a punta, como una madera real.
  const wood = useMemo(() => repeated(woodMaps(), 3, 1), [])
  // En el alambre la repetición va sobre la V, que es la que corre a lo largo.
  const wire = useMemo(() => repeated(metalMaps(), 1, 30), [])

  useFrame(() => {
    const posts = postsRef.current
    const wires = wiresRef.current
    if (!posts || !wires) return

    const progress = progressRef.current
    const raise = stage(progress, CHAPTERS.fence[0], CHAPTERS.fence[0] + 0.08)
    const thread = stage(progress, CHAPTERS.fence[0] + 0.07, CHAPTERS.fence[1])

    posts.children.forEach((post) => growY(post, raise))
    wires.children.forEach((w) => growY(w, thread))

    // Mismo motivo que en la varilla: los postes y los alambres crecen
    // escalando, así que la repetición sigue al escalado para que la veta no
    // se estire mientras suben.
    wood.map.repeat.y = Math.max(raise, 0.001)
    wood.roughnessMap.repeat.y = Math.max(raise, 0.001)
    wood.normalMap.repeat.y = Math.max(raise, 0.001)
    wire.roughnessMap.repeat.y = Math.max(30 * thread, 0.001)
    wire.normalMap.repeat.y = Math.max(30 * thread, 0.001)
  })

  return (
    <group position={[0, -ROD_LENGTH / 2, 0]}>
      <group ref={postsRef}>
        {[-3.2, 3.2].map((x) => (
          <mesh key={x} position={[x, ROD_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.22, 0.24, ROD_LENGTH, 16]} />
            <meshStandardMaterial {...wood} normalScale={[0.8, 0.8]} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Los alambres se escalan en Y porque están rotados 90° sobre Z. */}
      <group ref={wiresRef}>
        {HOLE_HEIGHTS.map((height) => (
          <mesh key={height} position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 6.8, 8]} />
            <meshStandardMaterial
              {...wire}
              color="#a6adb4"
              roughness={0.35}
              metalness={0.8}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Agrupa la máquina para poder retirarla de escena al llegar a la cerca. */
function Machine({ progressRef }) {
  const groupRef = useRef(null)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const retire = stage(progressRef.current, CHAPTERS.drill[1], CHAPTERS.fence[0] + 0.06)
    group.scale.setScalar(Math.max(1 - retire, 0.0001))
  })

  return (
    <group ref={groupRef}>
      <Hopper />
      <Barrel progressRef={progressRef} />
      <Mold progressRef={progressRef} />
    </group>
  )
}

/** Recorrido de cámara: sigue el material a lo largo de toda la línea. */
const CAMERA_KEYFRAMES = [
  // Arranca abierta para que entren en cuadro las botellas y la boca de la tolva.
  { at: 0.0, position: [-3.0, 2.5, 7.2], target: [-3.6, 1.9, 0] },
  { at: 0.16, position: [-2.9, 2.0, 6.6], target: [-3.6, 1.4, 0] },
  { at: 0.28, position: [-2.7, 1.2, 5.6], target: [-3.5, 0.6, 0] },
  { at: 0.4, position: [-2.2, 0.8, 4.8], target: [-2.9, 0.1, 0] },
  { at: 0.55, position: [0.2, 0.7, 8.4], target: [0.4, 0.0, 0] },
  { at: 0.7, position: [2.2, 1.1, 5.6], target: [2.2, 0.15, 0] },
  { at: 0.86, position: [1.0, 0.4, 9.8], target: [0.4, 0.0, 0] },
  { at: 1.0, position: [0, 0.2, 11.5], target: [0, 0, 0] },
]

function CameraRig({ progressRef }) {
  const { camera } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((state) => {
    const progress = progressRef.current

    let from = CAMERA_KEYFRAMES[0]
    let to = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1]
    for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i += 1) {
      if (progress >= CAMERA_KEYFRAMES[i].at && progress <= CAMERA_KEYFRAMES[i + 1].at) {
        from = CAMERA_KEYFRAMES[i]
        to = CAMERA_KEYFRAMES[i + 1]
        break
      }
    }

    const span = to.at - from.at
    const t = span === 0 ? 0 : clamp01((progress - from.at) / span)

    target.set(
      lerp(from.target[0], to.target[0], t),
      lerp(from.target[1], to.target[1], t),
      lerp(from.target[2], to.target[2], t),
    )
    position.set(
      lerp(from.position[0], to.position[0], t),
      lerp(from.position[1], to.position[1], t),
      lerp(from.position[2], to.position[2], t),
    )

    // En pantallas angostas alejamos la cámara: la varilla es muy alargada.
    const aspect = state.size.width / state.size.height
    const pullback = Math.max(1, 1.3 / aspect)
    position.sub(target).multiplyScalar(pullback).add(target)

    /*
      Paneo para que la acción no quede detrás del texto. Movemos cámara y
      objetivo juntos, así el encuadre se desplaza sin cambiar el ángulo.
      En apaisado el texto está a la izquierda, así que corremos la escena a
      la derecha; en vertical está abajo y la subimos.
    */
    const distance = position.distanceTo(target)
    const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance

    if (aspect >= 1) {
      const shift = visibleHeight * aspect * 0.15
      forward.subVectors(target, position).normalize()
      right.crossVectors(forward, up).normalize()
      position.addScaledVector(right, -shift)
      target.addScaledVector(right, -shift)
    } else {
      const shift = visibleHeight * 0.12
      position.addScaledVector(up, -shift)
      target.addScaledVector(up, -shift)
    }

    camera.position.copy(position)
    camera.lookAt(target)
  })

  return null
}

function RodScene({ progressRef }) {
  return (
    <Canvas
      camera={{ position: [-3.1, 2.6, 5.6], fov: 42 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#101f30']} />
      <fog attach="fog" args={['#101f30', 16, 34]} />

      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 6]} intensity={1.5} />
      <directionalLight position={[-6, 2, -4]} intensity={0.5} color="#6cace4" />
      <pointLight
        position={[BARREL_END_X, 0, 1.2]}
        intensity={9}
        color="#ffa53d"
        distance={6}
      />

      <Bottles progressRef={progressRef} />
      <Machine progressRef={progressRef} />
      <Rod progressRef={progressRef} />
      <Drills progressRef={progressRef} />
      <Fence progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
    </Canvas>
  )
}

export default RodScene
