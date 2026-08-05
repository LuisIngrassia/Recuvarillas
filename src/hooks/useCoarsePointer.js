import { useEffect, useState } from 'react'

/**
 * Indica si el dispositivo apunta con el dedo en vez de con un mouse.
 *
 * Sirve para decidir gestos, y es mejor señal que el ancho de la pantalla: una
 * ventana angosta en una computadora sigue teniendo mouse, y una tablet ancha
 * sigue siendo táctil.
 */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    setCoarse(query.matches)

    const onChange = (event) => setCoarse(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return coarse
}
