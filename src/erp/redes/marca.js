/**
 * Las reglas del manual para Instagram que se pueden revisar solas.
 *
 * Salen de la sección 07 · Tono: la primera línea se sostiene sola, un número
 * en cada posteo, siempre una acción, tres o cuatro hashtags al final, nada de
 * emojis como viñetas, de vos, y la lista de palabras que no usamos.
 *
 * Lo que no se puede revisar con una regla —si la foto cuenta algo, si el tono
 * es el de alguien que atiende el teléfono en Luján— lo sigue mirando una
 * persona. Esto es para que esa persona no tenga que acordarse de lo demás.
 *
 * Cada aviso es `{ nivel, texto }`. `error` es algo que el manual prohíbe;
 * `aviso` es algo que conviene mirar pero puede tener su razón.
 */

const EVITAMOS = [
  [/\bsoluci[oó]n(es)?\b/i, 'soluciones'],
  [/\balto rendimiento\b/i, 'alto rendimiento'],
  [/\bagroindustrial(es)?\b/i, 'agroindustrial'],
  [/\beco[- ]?friendly\b/i, 'eco-friendly'],
  [/\binnovador(a|es|as)?\b/i, 'innovador'],
  [/\bdisruptiv[oa]s?\b/i, 'disruptivo'],
  [/\bpremium\b/i, 'premium'],
  [/\bmadera pl[aá]stica\b/i, '"madera plástica"'],
  [/\bpara toda la vida\b/i, '"para toda la vida"'],
  [/\b100\s?% garantizad[oa]\b/i, '"100% garantizado"'],
]

/*
  Las formas de tú y usted que más se escapan escribiendo para redes.

  Va con lookarounds de letra y no con `\b`, que sólo conoce las letras sin
  tilde: "tú" seguido de un espacio no lo encontraría nunca.
*/
const NO_VOSEO =
  /(?<!\p{L})(usted(es)?|tú|puedes|tienes|quieres|necesitas|contáctanos|escríbenos|llámanos|pídela|consúltanos)(?!\p{L})/iu

/** Instagram corta el texto del feed más o menos acá y pone "más". */
const CORTE_FEED = 125

/** Los textos visibles de la pieza, menos la reseña: esa va tal cual y no se corrige. */
export function textosDePieza(campos) {
  return [campos.etiqueta, campos.titular, campos.bajada, ...(campos.items ?? [])]
    .filter(Boolean)
    .join('\n')
}

export function contarHashtags(hashtags) {
  return (String(hashtags ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []).length
}

/** El texto tal cual se pega en Instagram: el cuerpo y, al final, los hashtags. */
export function textoParaPegar(post) {
  return [post.caption?.trim(), post.hashtags?.trim()].filter(Boolean).join('\n\n')
}

export function revisarPost(post) {
  const avisos = []
  const caption = String(post.caption ?? '')
  const pieza = textosDePieza(post.campos ?? {})
  const todo = `${caption}\n${pieza}`

  for (const [regla, palabra] of EVITAMOS) {
    if (regla.test(todo)) {
      avisos.push({ nivel: 'error', texto: `El manual pide no usar ${palabra}.` })
    }
  }

  if (NO_VOSEO.test(todo)) {
    avisos.push({ nivel: 'error', texto: 'Hablamos de vos: "escribinos", "podés", "pedila".' })
  }

  const soloHistoria = post.formatos?.length === 1 && post.formatos[0] === 'historia'

  // Una historia sola no lleva texto de posteo: las reglas del epígrafe no aplican.
  if (!soloHistoria) {
    if (!caption.trim()) {
      avisos.push({ nivel: 'error', texto: 'Falta el texto del posteo.' })
    } else {
      const primera = caption.trim().split('\n')[0]
      if (primera.length > CORTE_FEED) {
        avisos.push({
          nivel: 'aviso',
          texto: `La primera línea tiene ${primera.length} caracteres: Instagram la corta cerca de los ${CORTE_FEED}.`,
        })
      }
      if (!/whatsapp/i.test(caption)) {
        avisos.push({ nivel: 'aviso', texto: 'Falta la acción: escribinos por WhatsApp.' })
      }
      if (/^\s*\p{Extended_Pictographic}/mu.test(caption)) {
        avisos.push({ nivel: 'error', texto: 'Nada de emojis como viñetas.' })
      }
      if (/(^|\s)#[\p{L}\p{N}_]/u.test(caption)) {
        avisos.push({ nivel: 'aviso', texto: 'Los hashtags van al final, en su campo, no en el medio del texto.' })
      }
      if (caption.length + String(post.hashtags ?? '').length > 2200) {
        avisos.push({ nivel: 'error', texto: 'Instagram acepta hasta 2.200 caracteres.' })
      }
    }

    const hashtags = contarHashtags(post.hashtags)
    if (hashtags < 3 || hashtags > 4) {
      avisos.push({ nivel: 'aviso', texto: `Van tres o cuatro hashtags; hay ${hashtags}.` })
    }
  }

  if (!/\d/.test(todo)) {
    avisos.push({ nivel: 'aviso', texto: 'Falta un número: medida, precio o metros.' })
  }

  return avisos
}

/** Los avisos que salen de medir la pieza dibujada, en cada formato. */
export function revisarMedidas(medidas) {
  const avisos = []
  for (const [formato, medida] of Object.entries(medidas)) {
    if (!medida) continue
    const donde = formato === 'historia' ? 'la historia' : 'el feed'
    if (medida.faltaFoto) {
      avisos.push({ nivel: 'error', texto: `Falta elegir la foto.` })
    } else if (medida.fotoChica) {
      avisos.push({ nivel: 'aviso', texto: `En ${donde} el texto deja la foto muy chica.` })
    }
    if (medida.desborda) {
      avisos.push({ nivel: 'error', texto: `En ${donde} el texto no entra. Acortalo.` })
    } else if (medida.ajuste < 1) {
      avisos.push({
        nivel: 'aviso',
        texto: `En ${donde} el titular se achicó al ${Math.round(medida.ajuste * 100)}% para entrar.`,
      })
    }
  }
  // "Falta la foto" una sola vez aunque la digan los dos formatos.
  return avisos.filter(
    (aviso, index) => avisos.findIndex((otro) => otro.texto === aviso.texto) === index,
  )
}
