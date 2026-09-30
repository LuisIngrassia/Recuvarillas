import fotoModelo from '../../brand/assets/fotos/uso-alambrado-vs-madera.jpg'

/**
 * Varilla contra madera y hierro.
 *
 * La tabla es la del manual (01 · Esencia) y la foto es la foto modelo de la
 * sección 06: el poste de madera en el medio del alambrado cuenta la
 * comparación sin decir nada.
 */
const FILAS = [
  { tema: 'Humedad', nuestra: 'No se pudre', madera: 'Se pudre en la base', hierro: 'Se oxida' },
  { tema: 'Cerco eléctrico', nuestra: 'Plástico: no conduce', madera: 'Según la humedad', hierro: 'Conduce, lleva aisladores' },
  { tema: 'Perforado', nuestra: 'De fábrica, a medida', madera: 'A mano, en el campo', hierro: 'Según el modelo' },
  { tema: 'Mantenimiento', nuestra: 'Ninguno', madera: 'Reposición periódica', hierro: 'Pintura antióxido' },
  { tema: 'Origen', nuestra: 'Plástico recuperado, Luján', madera: 'Árbol talado', hierro: 'Industrial' },
]

function Comparison() {
  return (
    <section id="comparacion" className="py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="min-w-0 lg:col-span-7">
          <h2 className="font-display text-4xl text-grafito-900 sm:text-5xl lg:text-6xl">
            La negra es la que queda.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-grafito-500">
            En la foto hay un poste de madera entre nuestras varillas. Dentro de
            unos años va a ser el único que haya que cambiar.
          </p>

          <div className="-mx-4 mt-10 overflow-x-auto px-4">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b-2 border-grafito-900">
                  <th scope="col" className="py-3 pr-4">
                    <span className="sr-only">Tema</span>
                  </th>
                  <th scope="col" className="rotulo py-3 pr-4 text-grafito-900">Recuvarilla</th>
                  <th scope="col" className="rotulo py-3 pr-4 text-grafito-500">Madera</th>
                  <th scope="col" className="rotulo py-3 text-grafito-500">Hierro</th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map((fila) => (
                  <tr key={fila.tema} className="border-b border-grafito-200 align-baseline">
                    <th scope="row" className="py-4 pr-4 font-normal text-grafito-500">{fila.tema}</th>
                    <td className="py-4 pr-4 font-bold text-grafito-900">{fila.nuestra}</td>
                    <td className="py-4 pr-4 text-grafito-500">{fila.madera}</td>
                    <td className="py-4 text-grafito-500">{fila.hierro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <img
          src={fotoModelo}
          alt="Alambrado con varillas negras de Recuvarilla y un poste de madera en el medio"
          loading="lazy"
          width={1500}
          height={2000}
          className="aspect-[4/5] w-full rounded-md object-cover object-[50%_45%] lg:col-span-5"
        />
      </div>
    </section>
  )
}

export default Comparison
