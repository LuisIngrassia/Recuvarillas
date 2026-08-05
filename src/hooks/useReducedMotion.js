import { useEffect, useState } from 'react'

/**
 * Indica si el sistema pide reducir el movimiento. Lo usan las piezas animadas
 * para ofrecer una versión quieta a quien lo tenga activado.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)

    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
