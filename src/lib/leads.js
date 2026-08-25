/**
 * Registro de los presupuestos simulados.
 *
 * Cada simulación se manda a una planilla de Google, para poder llamar después
 * a quien coticé y no compró. Las instrucciones para montarla están en
 * `docs/planilla-de-contactos.md`.
 *
 * Mientras la URL esté vacía el simulador funciona igual: sólo no queda
 * registro de los contactos.
 */
export const LEADS_ENDPOINT = ''

/**
 * Manda un presupuesto a la planilla.
 *
 * Va como `text/plain` a propósito. Con `application/json` el navegador manda
 * antes un pedido de permiso (preflight) que Apps Script no contesta, y la
 * llamada falla; `text/plain` no lo dispara y del otro lado se parsea igual.
 *
 * Nunca lanza: que falle el registro no puede impedirle a nadie ver su
 * presupuesto.
 */
export async function recordLead(payload) {
  if (!LEADS_ENDPOINT) return false

  try {
    await fetch(LEADS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, fecha: new Date().toISOString() }),
    })
    return true
  } catch {
    return false
  }
}
