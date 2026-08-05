import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clamp01, lerp } from './storyMath'

const MODEL_URL = '/varilla.glb'

/**
 * Repintado del material, sin tocar el archivo GLB.
 *
 * El modelo trae rugosidad 0,92 y un albedo del 8%: una superficie hecha para
 * absorber luz, que queda como una silueta apagada por más luces que se le
 * agreguen. Con la rugosidad al 0,45 y una capa de barniz aparece el reflejo
 * largo sobre los cantos, que es lo que se lee como plástico y no como tiza.
 */
const ROD_MATERIAL_NAME = 'recycled_pp_rubber'
const ROD_COLOR = '#3a3934'
const ROD_ROUGHNESS = 0.45
const ROD_CLEARCOAT = 0.45
const ROD_CLEARCOAT_ROUGHNESS = 0.25

/** Alambrado en reposo. */
const FENCE_RODS = 7
const FENCE_SPACING = 0.55
const FENCE_SCALE = 0.78
/** La varilla del medio es la que se queda sola al interactuar. */
const HERO_INDEX = 3

/** Varilla sola: cuánto crece y cuánto se inclina. */
const SINGLE_SCALE = 1.5
const SINGLE_TILT_Z = 0.5
const SINGLE_TILT_X = 0.12
const SPIN_SPEED = 0.22

/**
 * Cuánto se corre a la derecha la varilla sola, en fracción del ancho.
 *
 * No la movemos de lugar ni corremos la cámara: desplazamos la proyección. Si
 * moviéramos el objeto, OrbitControls seguiría girando alrededor del origen y
 * la varilla se bambolearía en arco al arrastrarla en vez de girar sobre sí
 * misma. Así el centro de giro sigue siendo la varilla y sólo se corre el
 * encuadre.
 */
const SINGLE_SHIFT = 0.13

/**
 * El modelo no trae perforaciones: es una barra maciza. Pasamos los alambres
 * por el plano central de las varillas, así quedan tapados justo en el cruce y
 * reaparecen del otro lado. Se ve igual que si atravesaran un agujero.
 */
const WIRE_HEIGHTS = [-0.36, 0, 0.36]
const WIRE_LENGTH = 5.5
const WIRE_RADIUS = 0.0045

/** Qué tan rápido pasa de un modo al otro. */
const TRANSITION_SPEED = 2.6

/**
 * Carga la varilla, la para, la centra y le cambia el material.
 *
 * Devuelve un modelo base del que después se clona una copia por varilla. El
 * material se reemplaza en vez de modificarse porque useGLTF deja la escena
 * cacheada y mutarla ensuciaría cualquier otro uso del mismo archivo.
 */
function useRodModel() {
  const { scene } = useGLTF(MODEL_URL)

  return useMemo(() => {
    const root = scene.clone(true)
    // Viene acostada sobre X: esto la para y su eje largo pasa a ser Y.
    root.rotation.z = Math.PI / 2
    root.updateMatrixWorld(true)

    // Centrado por bounding box en vez de a mano: si cambia el modelo, sigue
    // girando sobre su propio eje igual.
    const box = new THREE.Box3().setFromObject(root)
    root.position.sub(box.getCenter(new THREE.Vector3()))

    const plastic = new THREE.MeshPhysicalMaterial({
      name: ROD_MATERIAL_NAME,
      color: new THREE.Color(ROD_COLOR),
      roughness: ROD_ROUGHNESS,
      metalness: 0.05,
      clearcoat: ROD_CLEARCOAT,
      clearcoatRoughness: ROD_CLEARCOAT_ROUGHNESS,
    })

    // Sólo la barra: la etiqueta tiene su propia textura y queda como está.
    root.traverse((child) => {
      if (child.isMesh && child.material?.name === ROD_MATERIAL_NAME) {
        child.material = plastic
      }
    })

    return root
  }, [scene])
}

/** Posición en X de cada varilla dentro del alambrado. */
const slotX = (index) => (index - (FENCE_RODS - 1) / 2) * FENCE_SPACING

/**
 * El alambrado y su transformación en una sola varilla.
 *
 * `modeRef` marca el destino (0 alambrado, 1 varilla sola) y `blend` lo
 * persigue suavizado, así el cambio nunca es un salto. Toda la animación se
 * hace moviendo objetos y no la cámara: en cuanto el visitante arrastra,
 * OrbitControls pasa a mandar sobre la cámara y pelearía contra nosotros.
 */
function Fence({ spin, modeRef }) {
  const base = useRodModel()
  const groupRef = useRef(null)
  const slotRefs = useRef([])
  const spinRefs = useRef([])
  const wiresRef = useRef(null)
  const blend = useRef(0)
  const shift = useRef(0)

  const models = useMemo(
    () => Array.from({ length: FENCE_RODS }, () => base.clone(true)),
    [base],
  )

  const wireMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8d949b',
        roughness: 0.35,
        metalness: 0.85,
        transparent: true,
      }),
    [],
  )

  useFrame((state, delta) => {
    blend.current += (modeRef.current - blend.current) * clamp01(delta * TRANSITION_SPEED)
    const t = blend.current
    // Suaviza las puntas del recorrido para que arranque y frene sin tirones.
    const ease = t * t * (3 - 2 * t)

    // En reposo el alambrado se mece despacio, lo justo para que no parezca una
    // foto. Al pasar a varilla sola el meceo se apaga.
    if (groupRef.current) {
      const sway = spin ? Math.sin(state.clock.elapsedTime * 0.25) * 0.18 : 0
      groupRef.current.rotation.y = sway * (1 - ease)
    }

    slotRefs.current.forEach((slot, index) => {
      if (!slot) return

      if (index === HERO_INDEX) {
        slot.scale.setScalar(lerp(1, SINGLE_SCALE, ease))
        slot.rotation.z = lerp(0, -SINGLE_TILT_Z, ease)
        slot.rotation.x = lerp(0, SINGLE_TILT_X, ease)
        return
      }

      // Las demás se apagan escalonadas y se abren hacia afuera al irse.
      const gone = clamp01(ease * 1.5 - Math.abs(index - HERO_INDEX) * 0.05)
      slot.visible = gone < 0.998
      slot.scale.setScalar(Math.max(1 - gone, 0.0001))
      slot.position.x = slotX(index) * (1 + ease * 0.7)
    })

    // La varilla sola gira sobre su propio eje; en el alambrado están quietas.
    const hero = spinRefs.current[HERO_INDEX]
    if (hero && spin) hero.rotation.y += delta * SPIN_SPEED * ease

    if (wiresRef.current) {
      wiresRef.current.visible = ease < 0.99
      wireMaterial.opacity = 1 - ease
    }

    /*
      Corrimiento del encuadre. El desplazamiento va al revés de lo que se
      mueve la varilla: correr la ventana de proyección hacia la izquierda
      (valor negativo) es lo que la deja a la derecha del centro.

      Sólo lo reescribimos cuando cambió de verdad, porque setViewOffset
      recalcula la matriz de proyección.
    */
    const { camera, size } = state
    const wanted = -size.width * SINGLE_SHIFT * ease
    if (Math.abs(wanted - shift.current) > 0.5) {
      shift.current = wanted
      if (Math.abs(wanted) < 0.5) camera.clearViewOffset()
      else camera.setViewOffset(size.width, size.height, wanted, 0, size.width, size.height)
    }
  })

  return (
    <group ref={groupRef} scale={FENCE_SCALE}>
      {models.map((model, index) => (
        <group
          key={index}
          ref={(el) => {
            slotRefs.current[index] = el
          }}
          position={[slotX(index), 0, 0]}
        >
          {/* Cada una arranca girada distinto para que no se vean clonadas. */}
          <group
            ref={(el) => {
              spinRefs.current[index] = el
            }}
            rotation={[0, index * 0.7, 0]}
          >
            <primitive object={model} />
          </group>
        </group>
      ))}

      <group ref={wiresRef}>
        {WIRE_HEIGHTS.map((y) => (
          <mesh
            key={y}
            position={[0, y, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={wireMaterial}
          >
            <cylinderGeometry args={[WIRE_RADIUS, WIRE_RADIUS, WIRE_LENGTH, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * Devuelve el scroll de la página en el celular.
 *
 * OrbitControls pone `touch-action: none` sobre el canvas, lo que secuestra el
 * gesto de arrastrar y deja al visitante trabado sin poder bajar. Con `pan-y`
 * el navegador se queda con el movimiento vertical (el scroll) y el control
 * recibe el horizontal, que es el que hace girar la varilla.
 */
function AllowPageScroll() {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const apply = () => {
      canvas.style.touchAction = 'pan-y'
    }

    apply()
    // OrbitControls lo vuelve a pisar al conectarse, así que insistimos una vez
    // que terminó de montarse.
    const id = window.setTimeout(apply, 0)
    return () => window.clearTimeout(id)
  }, [gl])

  return null
}

/** Doble clic: vuelve al alambrado y al encuadre inicial. */
function ResetOnDoubleClick({ controlsRef, modeRef }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const onDoubleClick = () => {
      modeRef.current = 0
      controlsRef.current?.reset()
    }

    canvas.addEventListener('dblclick', onDoubleClick)
    return () => canvas.removeEventListener('dblclick', onDoubleClick)
  }, [gl, controlsRef, modeRef])

  return null
}

/**
 * Visor del hero: alambrado en reposo, varilla sola al interactuar.
 *
 * @param spin si false, se queda quieto (para quien pide reducir movimiento).
 */
function RodViewer({ spin = true }) {
  const controlsRef = useRef(null)
  // 0 = alambrado, 1 = varilla sola. Es un ref y no estado porque lo lee el
  // bucle de animación en cada frame y no debe provocar re-renders.
  const modeRef = useRef(0)

  return (
    <Canvas
      camera={{ position: [0.55, 0.2, 2.3], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      {/*
        Set de estudio armado con geometría, sin depender de ningún HDR externo.
        Las intensidades son bajas a propósito: el entorno ya ilumina toda la
        escena, y sumarle ambiente y direccionales fuertes satura el material y
        lo lava hacia el blanco. La direccional de abajo sólo marca de dónde
        viene la luz.
      */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[0, 4, 2]}
          scale={[8, 6, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[-4, 1, 2]}
          scale={[5, 9, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[4, 2, -2]}
          scale={[5, 9, 1]}
          target={[0, 0, 0]}
        />
        {/* Panel angosto: es el que dibuja el reflejo largo sobre el canto. */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[1.6, 0, 3]}
          scale={[0.6, 9, 1]}
          target={[0, 0, 0]}
        />
      </Environment>

      <directionalLight position={[3, 4, 3]} intensity={0.8} />

      <Suspense fallback={null}>
        <Fence spin={spin} modeRef={modeRef} />
      </Suspense>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        // Cualquier gesto pasa a la varilla sola.
        onStart={() => {
          modeRef.current = 1
        }}
        enableDamping
        dampingFactor={0.08}
        enablePan
        /*
          Sin zoom: el canvas cubre el hero entero, así que si la rueda acerca
          la varilla el visitante no puede bajar la página. OrbitControls, con
          esto en false, ni siquiera intercepta el evento y el scroll sigue de
          largo al navegador.
        */
        enableZoom={false}
      />

      <AllowPageScroll />
      <ResetOnDoubleClick controlsRef={controlsRef} modeRef={modeRef} />
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)

export default RodViewer
