/**
 * La música y los efectos del video, sintetizados de cero.
 *
 * Una sola pieza, no una pista con sonidos encima: los golpes caen en los
 * cortes, los tics del tipeo están afinados en la misma escala que el pad, y
 * todo comparte el mismo delay, que es lo que hace que suenen en el mismo lugar
 * y no pegados aparte.
 *
 * La pieza está en La menor de punta a punta. El envión no viene de un cambio
 * de modo —resolver a mayor sobre un video de postes de alambrado sonaría a
 * publicidad de banco— sino del registro y de la dinámica: empieza grave y
 * apretada, y termina abierta.
 */
import fs from 'node:fs'

const SR = 44100
const DUR = 22.0
const N = Math.ceil(SR * DUR)

const L = new Float64Array(N)
const R = new Float64Array(N)

const TAU = Math.PI * 2
/** Semitonos por encima de La1 (55 Hz). */
const nota = (s) => 55 * Math.pow(2, s / 12)

const A1 = nota(0), A2 = nota(12), E3 = nota(19), A3 = nota(24)
const C4 = nota(27), E4 = nota(31), G4 = nota(34), A4 = nota(36)

/** Sube rápido y baja despacio: la forma de casi todo lo que suena golpeado. */
const env = (t, at, dec) => (t < 0 ? 0 : t < at ? t / at : Math.exp(-(t - at) / dec))
/** Rampa suave entre dos tiempos, para las entradas y salidas largas. */
const ramp = (t, a, b) => {
  if (t <= a) return 0
  if (t >= b) return 1
  const k = (t - a) / (b - a)
  return k * k * (3 - 2 * k)
}

/** Mezcla una muestra en los dos canales, con paneo. */
function mezclar(i, v, pan = 0) {
  if (i < 0 || i >= N) return
  L[i] += v * (1 - Math.max(0, pan))
  R[i] += v * (1 + Math.min(0, pan))
}

/* ------------------------------------------------------------------ pad --
   Tres voces con la afinación apenas corrida entre sí. Ese desfasaje es todo
   el "ancho" del sonido: sin él, tres senoidales en el mismo tono son una sola
   senoidal más fuerte.
*/
function pad(f, desde, hasta, gan, pan = 0) {
  const sub = [-0.11, 0, 0.13]
  for (let i = 0; i < N; i += 1) {
    const t = i / SR
    if (t < desde - 0.6 || t > hasta + 1.2) continue
    const a = ramp(t, desde - 0.5, desde + 0.9) * (1 - ramp(t, hasta, hasta + 1.1))
    if (a <= 0) continue

    let v = 0
    for (const d of sub) {
      const ff = f * Math.pow(2, d / 1200 * 12)
      /* Triangular por suma de armónicos impares: redonda, sin el filo del
         diente de sierra, que sobre voz hablada cansa. */
      v += Math.sin(TAU * ff * t)
        + 0.14 * Math.sin(TAU * ff * 3 * t)
        + 0.05 * Math.sin(TAU * ff * 5 * t)
    }
    /* Un latido lentísimo: evita que el pad suene a tono de prueba. */
    const respira = 1 + 0.06 * Math.sin(TAU * 0.13 * t)
    mezclar(i, (v / 3) * a * gan * respira, pan)
  }
}

/* ----------------------------------------------------------------- sub --
   El cuerpo. Va solo hasta el final y sostiene todo lo demás.
*/
for (let i = 0; i < N; i += 1) {
  const t = i / SR
  const a = ramp(t, 0, 1.2) * (1 - ramp(t, 20.4, 21.9))
  mezclar(i, Math.sin(TAU * A1 * t) * 0.20 * a)
}

/*
  El pad sigue las escenas: cerrado en el gancho, abierto en el cierre.

  Los tiempos son los de la línea de tiempo del video, no números redondos:
  gancho 0–3, alambrado 3–6,6, varilla 6,6–9,9, el sitio 9,9–13,3, el simulador
  13,3–18,3 y el cierre 18,3–22.
*/
pad(A2, 0.0,  6.6,  0.085, -0.15)
pad(E3, 0.0,  6.6,  0.055,  0.18)
pad(A2, 3.0, 18.3,  0.075, -0.20)
pad(E3, 3.0, 18.3,  0.060,  0.22)
pad(C4, 3.0, 18.3,  0.045,  0.05)
pad(A3, 18.1, 21.4, 0.075, -0.18)
pad(E4, 18.1, 21.4, 0.055,  0.20)
pad(C4, 18.1, 21.4, 0.048,  0.00)

/* --------------------------------------------------------------- golpes --
   Un seno que cae de golpe más un soplo de ruido filtrado. Cae en los cortes,
   no en un pulso: el video manda el ritmo, no al revés.
*/
function golpe(t0, gan, tono = 58) {
  const dur = 1.5
  for (let k = 0; k < dur * SR; k += 1) {
    const i = Math.round(t0 * SR) + k
    const t = k / SR
    /* La caída del tono es lo que lo hace sonar a impacto y no a nota. */
    const f = tono * Math.pow(2, -1.6 * Math.min(t, 0.5))
    const cuerpo = Math.sin(TAU * f * t) * Math.exp(-t / 0.20)
    const aire = (Math.random() * 2 - 1) * Math.exp(-t / 0.045) * 0.16
    mezclar(i, (cuerpo + aire) * gan)
  }
}

golpe(0.30, 0.34)
golpe(1.40, 0.34)
golpe(3.00, 0.52)   // el corte duro a la foto: el golpe más fuerte
golpe(6.60, 0.30)
golpe(9.90, 0.30)   // entra el sitio
golpe(13.30, 0.30)  // entra el simulador
golpe(18.30, 0.26)  // cierre

/* -------------------------------------------------------------- pluck --
   El motivo. Pentatónica de La menor, corcheas a 100 BPM, bien atrás en la
   mezcla: está para que el medio del video no sea sólo un pad quieto.
*/
function pluck(t0, f, gan, pan) {
  const dur = 1.1
  for (let k = 0; k < dur * SR; k += 1) {
    const i = Math.round(t0 * SR) + k
    const t = k / SR
    const e = env(t, 0.004, 0.16)
    const v = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)
      + 0.12 * Math.sin(TAU * f * 3 * t)) * e
    mezclar(i, v * gan * 0.33, pan)
  }
}

const FIG = [A3, C4, E4, C4, G4, E4, C4, A3]
const PASO = 0.30
for (let n = 0; n < 40; n += 1) {
  const t = 6.75 + n * PASO
  if (t > 17.6) break
  /* Entra y sale con la escena, para que no aparezca de golpe. */
  const g = ramp(t, 6.7, 7.6) * (1 - ramp(t, 16.9, 17.6))
  const acento = n % 8 === 0 ? 1.35 : n % 2 ? 0.62 : 0.9
  pluck(t, FIG[n % 8], 0.34 * g * acento, ((n % 4) - 1.5) * 0.12)
}

/* ----------------------------------------------------------------- tics --
   El tipeo del simulador. Afinados en la misma escala y muy por debajo del
   pad: se tienen que sentir, no escuchar.
*/
function tic(t0, f, gan) {
  for (let k = 0; k < 0.2 * SR; k += 1) {
    const i = Math.round(t0 * SR) + k
    const t = k / SR
    mezclar(i, Math.sin(TAU * f * t) * Math.exp(-t / 0.018) * gan, 0.1)
  }
}

/* Los tres dígitos de "500", en los mismos tiempos que los escribe la pantalla:
   la escena del simulador arranca en 13,3 y el tipeo, 1,15 s después. */
tic(14.45, A4, 0.085)
tic(14.62, C4 * 2, 0.085)
tic(14.79, E4 * 2, 0.085)

/* Y el precio apareciendo: dos notas, hacia arriba, muy suaves. */
pluck(15.32, E4, 0.20, -0.1)
pluck(15.50, A4, 0.24, 0.1)
/* El cierre, cuando entra el logo. */
pluck(18.85, A4, 0.18, 0.0)
pluck(19.10, E4, 0.14, 0.12)

/* ---------------------------------------------------------------- aire --
   Un soplo de ruido en cada corte, barrido de agudo a medio. Es lo que tapa la
   costura entre dos escenas y las hace sonar como una sola cosa.
*/
function aire(t0, gan) {
  const dur = 0.9
  let lp = 0
  for (let k = 0; k < dur * SR; k += 1) {
    const i = Math.round(t0 * SR) + k
    const t = k / SR
    const n = Math.random() * 2 - 1
    /* Filtro de un polo con el corte bajando: el barrido del "whoosh". */
    const corte = 0.55 * Math.exp(-t / 0.28) + 0.02
    lp += corte * (n - lp)
    const e = Math.sin(Math.PI * Math.min(t / dur, 1)) ** 2
    mezclar(i, lp * e * gan, Math.sin(t * 7) * 0.5)
  }
}

aire(2.72, 0.10)
aire(6.34, 0.075)
aire(9.64, 0.075)
aire(13.04, 0.075)
aire(18.04, 0.060)

/* --------------------------------------------------------------- delay --
   Un eco corto y cruzado, igual para todo. Es lo que pone a la música y a los
   efectos en la misma sala.
*/
const RET = Math.round(0.26 * SR)
for (let i = RET; i < N; i += 1) {
  const l = L[i - RET] * 0.19
  const r = R[i - RET] * 0.19
  L[i] += r
  R[i] += l
}

/* ------------------------------------------------------- mezcla final --
   Normalizar y después un limitador blando: la tangente hiperbólica redondea
   los picos en vez de recortarlos en seco, que es lo que suena a distorsión.
*/
let pico = 0
for (let i = 0; i < N; i += 1) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]))
const k = pico > 0 ? 0.82 / pico : 1

const buf = Buffer.alloc(N * 4)
for (let i = 0; i < N; i += 1) {
  /* Medio segundo de entrada y uno de salida, para que no haya un clic en los
     extremos del archivo. */
  const t = i / SR
  const a = ramp(t, 0, 0.35) * (1 - ramp(t, DUR - 1.0, DUR))
  const l = Math.tanh(L[i] * k * 1.25) * 0.86 * a
  const r = Math.tanh(R[i] * k * 1.25) * 0.86 * a
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(l * 32767))), i * 4)
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(r * 32767))), i * 4 + 2)
}

/** Cabecera WAV de 44 bytes, PCM 16 bits estéreo. */
const cab = Buffer.alloc(44)
cab.write('RIFF', 0)
cab.writeUInt32LE(36 + buf.length, 4)
cab.write('WAVE', 8)
cab.write('fmt ', 12)
cab.writeUInt32LE(16, 16)
cab.writeUInt16LE(1, 20)
cab.writeUInt16LE(2, 22)
cab.writeUInt32LE(SR, 24)
cab.writeUInt32LE(SR * 4, 28)
cab.writeUInt16LE(4, 32)
cab.writeUInt16LE(16, 34)
cab.write('data', 36)
cab.writeUInt32LE(buf.length, 40)

fs.writeFileSync(new URL('./track.wav', import.meta.url), Buffer.concat([cab, buf]))
process.stdout.write(`track.wav · ${DUR}s · pico previo ${pico.toFixed(2)}\n`)
