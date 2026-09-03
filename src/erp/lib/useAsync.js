/**
 * Carga de datos para las pantallas del ERP.
 *
 * Todas hacen lo mismo: piden algo, muestran "cargando", muestran el error si
 * lo hay, y vuelven a pedir cuando algo cambió. Repetir ese `useEffect` en cada
 * una es donde se cuelan los bugs: la respuesta vieja que pisa a la nueva, el
 * `setState` después de desmontar, el error que nadie muestra.
 */
import { useCallback, useEffect, useState } from 'react'

export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)

  // El loader se recrea en cada render de la pantalla, así que las dependencias
  // que mandan son las que declara quien llama, no la función en sí.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    run()
      .then((data) => {
        // Si mientras tanto cambió el filtro, esta respuesta ya no corresponde
        // a lo que se está mirando y se descarta.
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [run, nonce])

  /** Vuelve a pedir los datos, después de guardar o borrar algo. */
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...state, reload }
}
