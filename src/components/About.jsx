import fotoPallet from '../../brand/assets/fotos/producto-pallet.jpg'

/**
 * Nosotros: la esencia del manual de marca (sección 01).
 *
 * Los textos son los del manual —propósito, misión, visión y valores— para
 * que la web y el resto de las piezas digan lo mismo con las mismas palabras.
 * Si cambian, se cambian primero en el manual.
 */
const VALORES = [
  { titulo: 'Durar', texto: 'Hacemos cosas que no haya que reponer. Si algo no aguanta el campo, no sale.' },
  { titulo: 'Decir las cosas como son', texto: 'Medidas, precios y plazos claros. Sin promesas que no podamos medir.' },
  { titulo: 'Aprovechar', texto: 'Si un material todavía puede servir, no se tira: se transforma.' },
  { titulo: 'Resolver', texto: 'Cortamos, perforamos y adaptamos. El alambrado de cada campo es distinto.' },
]

/** Datos medibles del negocio. Nada de números para impresionar. */
const DATOS = [
  { value: '+25', label: 'clientes que ya alambraron con Recuvarilla' },
  { value: '+100 t', label: 'de plástico recuperado por año' },
]

function About() {
  return (
    <section id="nosotros" className="py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-7">
          <h2 className="font-display text-4xl text-grafito-900 sm:text-5xl lg:text-6xl">
            Cada varilla saca plástico de la calle y lo planta en el campo.
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-grafito-500">
            Juntamos botellas y tapitas de polipropileno en la provincia de
            Buenos Aires, las molemos, las fundimos y las moldeamos en Luján.
            Nada viaja desde afuera: ni el material, ni la máquina, ni la gente.
          </p>

          <dl className="mt-10 grid gap-8 border-t-2 border-grafito-900 pt-8 sm:grid-cols-2">
            <div>
              <dt className="rotulo text-grafito-500">Propósito</dt>
              <dd className="mt-2 font-display text-3xl text-grafito-900">
                Que lo que se tira termine sosteniendo el campo.
              </dd>
            </div>
            <div className="space-y-5">
              <div>
                <dt className="rotulo text-grafito-500">Misión</dt>
                <dd className="mt-2 text-grafito-700">
                  Fabricar en Luján varillas de plástico recuperado que duren
                  más que las de madera, perforarlas a la medida de cada
                  alambrado y hacerlas llegar a cada campo.
                </dd>
              </div>
              <div>
                <dt className="rotulo text-grafito-500">Visión</dt>
                <dd className="mt-2 text-grafito-700">
                  Que en la región pampeana la varilla reciclada sea la opción
                  de todos los días, no la alternativa.
                </dd>
              </div>
            </div>
          </dl>

          <h3 className="rotulo mt-12 text-grafito-500">Valores</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {VALORES.map((valor) => (
              <li key={valor.titulo} className="border-t border-grafito-200 pt-4">
                <p className="text-lg font-bold text-grafito-900">{valor.titulo}</p>
                <p className="mt-1 text-grafito-500">{valor.texto}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-5">
          <img
            src={fotoPallet}
            alt="Pallet de varillas Recuvarilla atadas con zunchos celestes"
            loading="lazy"
            width={941}
            height={1672}
            className="aspect-[4/5] w-full rounded-md object-cover object-[50%_35%]"
          />
          <dl className="mt-8 grid grid-cols-2 gap-6">
            {DATOS.map((dato) => (
              <div key={dato.label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="text-sm text-grafito-500">{dato.label}</dt>
                <dd className="font-mono text-3xl font-medium text-grafito-900">{dato.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

export default About
