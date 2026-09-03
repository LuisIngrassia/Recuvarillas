/**
 * Retrasa un valor hasta que deja de cambiar.
 *
 * Los buscadores del ERP disparan una consulta por cada cambio. Sin esto,
 * escribir "Gutiérrez" son nueve consultas de las que ocho no se llegan a
 * mirar, y la última en contestar no es necesariamente la última que se pidió.
 */
import { useEffect, useState } from 'react'

export function useDebounced(value, delay = 300) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
