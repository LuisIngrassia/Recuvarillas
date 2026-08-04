import { useEffect, useRef, useState } from 'react'

/**
 * Avisa cuando el elemento se acerca al viewport. Lo usamos para no descargar
 * three.js hasta que el usuario esté por llegar a la sección.
 */
export function useNearViewport(ref, rootMargin = '200px') {
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || isNear) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNear(true)
      },
      { rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin, isNear])

  return isNear
}

/**
 * Devuelve un ref con el progreso (0 a 1) del scroll dentro del elemento
 * referenciado. Se actualiza por fuera del ciclo de render de React para no
 * disparar re-renders en cada scroll: la escena 3D lo lee desde useFrame.
 *
 * El valor no sigue al scroll de forma literal sino que lo persigue con
 * suavizado. Sin esto, al acortar el recorrido cada rueda del mouse produce un
 * salto grande y la animación se ve entrecortada.
 *
 * @param smoothing cuánto se acerca al valor real por frame (0 a 1). Más bajo
 *                  es más suave y más pesado; 1 desactiva el suavizado.
 */
export function useScrollProgress(smoothing = 0.14) {
  const targetRef = useRef(null)
  const progressRef = useRef(0)

  useEffect(() => {
    const rawRef = { current: 0 }
    let frame = null
    let started = false

    const readScroll = () => {
      const el = targetRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      rawRef.current =
        scrollable <= 0 ? 0 : Math.min(Math.max(-rect.top / scrollable, 0), 1)
    }

    const tick = () => {
      const diff = rawRef.current - progressRef.current
      // Al converger cortamos el bucle; el scroll lo vuelve a arrancar.
      if (Math.abs(diff) < 0.0002) {
        progressRef.current = rawRef.current
        frame = null
        return
      }

      progressRef.current += diff * smoothing
      frame = requestAnimationFrame(tick)
    }

    const update = () => {
      readScroll()
      if (!started) {
        // El primer valor se toma tal cual, para no animar desde 0 si el
        // usuario entra con la página ya scrolleada.
        progressRef.current = rawRef.current
        started = true
        return
      }
      if (frame === null) frame = requestAnimationFrame(tick)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [smoothing])

  return { targetRef, progressRef }
}
