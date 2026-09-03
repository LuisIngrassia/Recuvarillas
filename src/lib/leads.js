/**
 * Registro de los presupuestos simulados.
 *
 * Cada simulación se guarda en dos lados: en Supabase, que es de donde los lee
 * el ERP, y en la planilla de Google de siempre. Escribir en los dos es a
 * propósito mientras dure la transición —la planilla queda como respaldo y no
 * se pierde el histórico— y se puede cortar borrando `LEADS_ENDPOINT`. Las
 * instrucciones de la planilla están en `docs/planilla-de-contactos.md`.
 *
 * Ninguno de los dos envíos es obligatorio: si faltan las dos configuraciones
 * el simulador anda igual, sólo que no queda registro del contacto.
 */
import { isSupabaseConfigured, restInsert } from './supabaseRest'

export const LEADS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxvIKQjA0OYAZPCDZSPJ-H25RhsIYSwsFFuhec77QHgdVat2cMVSVtJ1iLPtx7mzWlE/exec'

/**
 * Manda un presupuesto a la planilla.
 *
 * Va como `text/plain` a propósito. Con `application/json` el navegador manda
 * antes un pedido de permiso (preflight) que Apps Script no contesta, y la
 * llamada falla; `text/plain` no lo dispara y del otro lado se parsea igual.
 */
async function sendToSheet(payload) {
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

/**
 * Guarda el lead en la base, que es lo que después ve el ERP.
 *
 * La política de Supabase deja insertar sin sesión pero no leer ni editar, así
 * que desde la web sólo se puede agregar un contacto nuevo.
 *
 * `origen` va escrito y no librado al valor por defecto de la columna, aunque
 * el default diga lo mismo: la política exige `origen = 'web'` para las
 * inserciones anónimas, y si algún día ese default cambia, esto dejaría de
 * pasar el filtro. Como el error se traga a propósito —abajo, para no romperle
 * el formulario a nadie— el síntoma sería que los leads dejan de llegar sin que
 * nada avise. Mejor que la condición esté a la vista de quien lea esta función.
 */
async function sendToSupabase(lead) {
  if (!isSupabaseConfigured) return false

  try {
    await restInsert('leads', {
      origen: 'web',
      nombre: lead.nombre,
      telefono: lead.telefono || null,
      email: lead.email || null,
      cantidad: lead.cantidad,
      agujereada: lead.agujereada,
      entrega: lead.entrega,
      codigo_postal: lead.codigoPostal || null,
      localidad: lead.localidad || null,
      provincia: lead.provincia || null,
      kilometros: lead.kilometros ?? null,
      precio_unitario: lead.precioUnitario,
      mercaderia: lead.mercaderia,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Registra un presupuesto simulado.
 *
 * Nunca lanza: que falle el registro no puede impedirle a nadie ver su
 * presupuesto. Devuelve dónde se pudo guardar, por si alguna pantalla quiere
 * saberlo.
 */
export async function recordLead(lead) {
  const [supabaseOk, sheetOk] = await Promise.all([
    sendToSupabase(lead),
    /*
      La planilla espera las columnas con estos nombres exactos y en castellano
      llano, así que la traducción se hace acá y no se le pide al que llama que
      arme dos formas del mismo dato.
    */
    sendToSheet({
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      cantidad: lead.cantidad,
      agujereada: lead.agujereada ? 'Sí' : 'No',
      entrega: lead.entrega === 'envio' ? 'Envío' : 'Retiro en fábrica',
      codigoPostal: lead.codigoPostal,
      localidad: lead.localidad,
      provincia: lead.provincia,
      kilometros: lead.kilometros ?? '',
      precioUnitario: lead.precioUnitario,
      mercaderia: lead.mercaderia,
      // Queda escrito en la planilla que falta cotizarlo, para que nadie lea
      // una columna vacía como un envío sin cargo.
      flete: lead.entrega === 'envio' ? 'A cotizar' : '',
      total: lead.mercaderia,
    }),
  ])

  return { supabase: supabaseOk, sheet: sheetOk }
}
