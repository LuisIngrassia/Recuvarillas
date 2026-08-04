export const clamp01 = (v) => Math.min(Math.max(v, 0), 1)

export const lerp = (a, b, t) => a + (b - a) * t

/** Interpolación suave (derivada 0 en los extremos) para evitar cortes bruscos. */
export const smoothstep = (t) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Progreso local 0-1 de una etapa que va de `start` a `end` dentro del scroll global. */
export const stage = (progress, start, end) =>
  smoothstep((progress - start) / (end - start))

/**
 * Genera valores pseudoaleatorios reproducibles. Usamos una semilla fija para
 * que los fragmentos ocupen siempre las mismas posiciones entre recargas.
 */
export const seededRandom = (seed) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
