/**
 * El folleto de una hoja, el que se deja en el mostrador.
 *
 * Reemplaza a `docs/folleto_recu_varilla.html`. Aquel archivo ya tenía el
 * bloque «Contacto del vendedor», pero con datos de ejemplo que había que
 * completar a mano en cada copia; el resultado previsible era que la mitad de
 * los folletos se repartieran diciendo «Nombre y Apellido · 011 0000-0000».
 * Acá el vendedor se elige de una lista y el bloque sale lleno.
 *
 * El diseño es el folleto del manual de marca (10 · Aplicaciones de marca):
 * la franja arriba, una frase y una foto real que venden, y abajo lo que
 * explica —medida, beneficios, cómo pedir—. Las fotos y el gráfico de
 * dimensiones salen de `brand/assets`, tal cual.
 */
import { documentoPorTipo } from '../lib/documentos'
import DocSheet, { LogoHoja, PieContacto } from '../components/DocSheet'
import fotoUso from '../../../brand/assets/fotos/uso-alambrado-vs-madera.jpg'
import fotoPallet from '../../../brand/assets/fotos/producto-pallet.jpg'
import dimensionesUrl from '../../../brand/assets/producto/dimensiones-perforada.svg?url'

const ESPECIFICACIONES = [
  ['Largo', '120 cm'],
  ['Sección', '3 × 3 cm'],
  ['Peso aproximado', '1.000 g'],
  ['Material', 'Polipropileno (PP) recuperado de descarte industrial'],
  ['Protección UV', 'Sí, estabilizante UV incorporado'],
  ['Agujereado', 'Opcional, a pedido'],
  ['Presentación', 'Packs de 10 unidades · mínimo 10 packs'],
  ['Flete', 'A cargo del comprador, despacho desde Luján'],
]

const VENTAJAS = [
  'No se pudre ni se oxida: aguanta la humedad y el sol.',
  'No lo atacan los insectos.',
  'Sin mantenimiento: no se pinta ni se repone.',
  'Agujereada de fábrica a la altura de cada hilo.',
  'Plástico: sirve para cercos eléctricos.',
  'Precio más bajo por cantidad.',
]

const ESTILOS = `
.folleto { padding-top: 0; }
.folleto .hm-franja { margin: 0 -44px 32px; }
.folleto .fotos { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-top: 22px; }
.folleto .fotos img { width: 100%; height: 280px; object-fit: cover; border-radius: 4px; display: block; }
.folleto .fotos .uso { object-position: 35% 45%; }
.folleto .fotos .pallet { object-position: 50% 30%; }
.folleto .dimensiones { width: 100%; display: block; border: 1px solid var(--linea); border-radius: 4px; }
.folleto .dos { display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px; align-items: start; }
@media (max-width: 720px) {
  .folleto .hm-franja { margin: 0 -20px 24px; }
  .folleto .fotos, .folleto .dos { grid-template-columns: 1fr; }
}
`

export default function DocBrochure() {
  const doc = documentoPorTipo('folleto')

  return (
    <DocSheet doc={doc}>
      {(contacto) => (
        <>
          <style>{ESTILOS}</style>

          <div className="hm folleto doc-hoja">
            <div className="hm-franja" aria-hidden="true" />

            <header className="hm-cabecera">
              <LogoHoja />
              <span className="hm-tipo">Varillas para alambrado</span>
            </header>

            <h1 className="hm-titular" style={{ fontSize: 52 }}>
              Hecha para el campo.
              <br />
              Pensada para durar.
            </h1>
            <p className="hm-bajada">
              Varillas de plástico recuperado para alambrados, hechas en Luján.
              3 × 3 × 120 cm, lisas o agujereadas a la medida de tu alambrado.
            </p>

            <div className="fotos">
              <img className="uso" src={fotoUso} alt="Alambrado con varillas Recuvarilla" />
              <img className="pallet" src={fotoPallet} alt="Pallet de varillas Recuvarilla" />
            </div>

            <div className="hm-seccion">
              <span className="hm-rotulo">La varilla</span>
            </div>
            <img className="dimensiones" src={dimensionesUrl} alt="Varilla de 120 cm de largo y sección de 3 × 3 cm" />

            <div className="dos" style={{ marginTop: 22 }}>
              <div>
                <p className="hm-rotulo" style={{ marginBottom: 6 }}>Especificaciones</p>
                <table>
                  <tbody>
                    {ESPECIFICACIONES.map(([clave, valor]) => (
                      <tr key={clave}>
                        <td className="apagado">{clave}</td>
                        <td style={{ fontWeight: 600 }}>{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="hm-rotulo" style={{ marginBottom: 10 }}>Por qué conviene</p>
                <ul className="hm-lista">
                  {VENTAJAS.map((ventaja) => (
                    <li key={ventaja}>{ventaja}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Cuando sale el contacto de la empresa el rótulo tiene que
                decirlo: «Contacto del vendedor» arriba del teléfono general
                sería una promesa que el papel no cumple. */}
            <p className="hm-rotulo" style={{ margin: '28px 0 -14px' }}>
              {contacto.esEmpresa ? 'Pedí tu presupuesto' : 'Contacto del vendedor'}
            </p>
            <PieContacto contacto={contacto} />
          </div>
        </>
      )}
    </DocSheet>
  )
}
