/**
 * Quién está cerca de un viaje que ya sale.
 *
 * El flete es lo que más veces mata una venta lejos: la varilla compite bien y
 * el envío no. Pero el grueso del costo de un envío es el viaje, no la varilla
 * de más. Si ya hay un pedido confirmado a Rosario, al de al lado se le puede
 * ofrecer un flete que solo no pagaría.
 *
 * Esta pantalla no cotiza ni despacha nada: contesta a quién llamar, y en qué
 * orden. Lo que se le ofrece a cada uno lo decide quien llama.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CERCANIA_HINTS,
  CERCANIA_LABELS,
  CERCANIA_TONES,
  MOTIVOS_DE_LLAMADO,
  cercaDe,
  listDestinos,
  listViajes,
  listZonas,
  porProvincia,
  prioridad,
} from '../api/shipping'
import { LEAD_STATE_LABELS, LOST_REASON_LABELS } from '../api/leads'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatNumber, whatsappLink } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/** Cómo se lee un destino en una línea. */
const comoTexto = (destino) =>
  [destino.localidad, destino.provincia].filter(Boolean).join(', ') || 'Sin localidad'

/**
 * La fila de alguien que está cerca.
 *
 * Lo primero es por qué llamarlo y no quién es: la lista se lee para decidir a
 * quién marcar, y "se perdió por el flete" es lo que hace que uno valga más que
 * el de al lado.
 */
function Candidato({ punto }) {
  const wa = whatsappLink(punto.telefono)
  const razon = MOTIVOS_DE_LLAMADO[prioridad(punto)]
  const porFlete = punto.lost_reason === 'freight'

  return (
    <tr className={`hover:bg-steel-50 ${porFlete ? 'bg-amber-50/60' : ''}`}>
      <Td>
        <span className="font-medium text-steel-700">
          {punto.clase === 'cliente' ? (
            <Link
              to={`/erp/clientes/${punto.id}`}
              className="hover:text-secondary-500"
            >
              {punto.nombre}
            </Link>
          ) : (
            <Link to={`/erp/leads/${punto.id}`} className="hover:text-secondary-500">
              {punto.nombre}
            </Link>
          )}
        </span>
        <span className="block text-xs text-steel-400">{punto.telefono}</span>
      </Td>
      <Td>
        <Badge tone={porFlete ? 'warn' : punto.clase === 'cliente' ? 'good' : 'neutral'}>
          {razon}
        </Badge>
        {punto.clase === 'lead' && punto.status && (
          <span className="mt-0.5 block text-xs text-steel-400">
            {LEAD_STATE_LABELS[punto.status] ?? punto.status}
            {punto.lost_reason && ` · ${LOST_REASON_LABELS[punto.lost_reason]}`}
          </span>
        )}
      </Td>
      <Td className="text-xs text-steel-500">
        {punto.localidad || <span className="text-steel-300">sin localidad</span>}
        <span className="block text-steel-400">
          {punto.provincia}
          {punto.codigo_postal ? ` · ${punto.codigo_postal}` : ''}
        </span>
      </Td>
      <Td>
        <Badge tone={CERCANIA_TONES[punto.cercania]}>
          {CERCANIA_LABELS[punto.cercania]}
        </Badge>
      </Td>
      <Td align="right">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-secondary-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600"
          >
            WhatsApp
          </a>
        )}
      </Td>
    </tr>
  )
}

export default function Shipping() {
  /* El destino elegido: o un viaje que ya sale, o una provincia entera. Los dos
     terminan siendo lo mismo —un código postal y una provincia— así que la
     cuenta de quién está cerca es una sola. */
  const [destino, setDestino] = useState(null)

  const query = useAsync(async () => {
    const [padron, viajes, zonas] = await Promise.all([
      listDestinos(),
      listViajes(),
      listZonas(),
    ])
    return { destinos: padron.filas, padron, viajes, zonas }
  }, [])

  return (
    <>
      <PageHeader
        title="Envíos"
        description="Quién está cerca de un viaje que ya sale, para ofrecerle un flete compartido."
      />

      <Async query={query}>
        {({ destinos, padron, viajes, zonas }) => {
          const conDireccion = destinos.filter((punto) => punto.cp !== null)
          const sinDireccion = destinos.length - conDireccion.length
          const provincias = porProvincia(destinos)
          const perdidosPorFlete = destinos.filter(
            (punto) => punto.lost_reason === 'freight',
          ).length

          const cerca = destino
            ? cercaDe(destino, destinos, zonas, destino.excluir ?? [])
            : []
          const ordenados = [...cerca].sort(
            (a, b) => prioridad(a) - prioridad(b) || a.saltoCp - b.saltoCp,
          )

          return (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Viajes abiertos"
                  value={formatNumber(viajes.length)}
                  hint="Confirmados o en producción, sin entregar"
                />
                <Stat
                  label="Con dirección"
                  value={formatNumber(conDireccion.length)}
                  hint={`${formatNumber(provincias.length)} provincias`}
                />
                <Stat
                  label="Perdidos por el flete"
                  value={formatNumber(perdidosPorFlete)}
                  tone="warn"
                  hint="Ya quisieron comprar; los frenó el envío"
                />
                <Stat
                  label="Sin dirección"
                  value={formatNumber(sinDireccion)}
                  hint="No se les puede ofrecer un envío"
                />
              </div>

              {/* Si la base cortó la respuesta, la pantalla lo dice: un «no hay
                  nadie cerca» sacado de media cartera es una respuesta
                  equivocada, no una respuesta incompleta. */}
              {!padron.completo && (
                <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
                  Se están mirando {formatNumber(destinos.length)} de{' '}
                  {formatNumber(padron.total)} contactos: la base cortó la
                  respuesta. Lo que sigue es cierto de esa parte, pero puede
                  haber gente cerca de un viaje que no aparece acá.
                </div>
              )}

              {zonas.length === 0 && (
                <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                  No hay zonas de flete cargadas, así que «cerca» sólo puede
                  significar misma localidad o misma provincia. Cargando el
                  tarifario, la pantalla puede decir además qué destinos{' '}
                  <strong>cuestan lo mismo</strong>, que es lo que de verdad
                  hace barato un envío compartido.{' '}
                  <Link to="/erp/fletes" className="font-semibold underline underline-offset-2">
                    Cargar fletes
                  </Link>
                </div>
              )}

              <Card title="Viajes que ya salen">
                {viajes.length === 0 ? (
                  <Empty>
                    No hay pedidos confirmados con envío pendiente. Cuando haya
                    uno, acá aparece quién más está cerca de ese destino.
                  </Empty>
                ) : (
                  <Table
                    head={
                      <>
                        <Th>Pedido</Th>
                        <Th>Cliente</Th>
                        <Th>Destino</Th>
                        <Th align="right">Unidades</Th>
                        <Th align="right">Cerca</Th>
                      </>
                    }
                  >
                    {viajes.map((viaje) => {
                      /* Cuántos hay cerca se calcula para cada viaje y no sólo
                         para el elegido: es el número que hace que uno valga la
                         pena mirar y otro no. */
                      const cuantos = cercaDe(viaje, destinos, zonas).length
                      const elegido = destino?.id === viaje.id

                      return (
                        <tr
                          key={viaje.id}
                          onClick={() =>
                            setDestino(
                              elegido
                                ? null
                                : {
                                    ...viaje,
                                    titulo: `el pedido #${viaje.numero}`,
                                    /* El cliente del pedido no se ofrece a sí
                                       mismo que se suba a su propio envío. */
                                    excluir: [],
                                  },
                            )
                          }
                          className={`cursor-pointer hover:bg-steel-50 ${
                            elegido ? 'bg-secondary-50' : ''
                          }`}
                        >
                          <Td className="whitespace-nowrap font-medium text-steel-700">
                            #{viaje.numero}
                            <span className="block text-xs font-normal text-steel-400">
                              {formatDate(viaje.fecha)}
                            </span>
                          </Td>
                          <Td className="text-steel-600">{viaje.cliente_nombre}</Td>
                          <Td className="text-sm text-steel-600">
                            {comoTexto(viaje)}
                            {viaje.codigo_postal && (
                              <span className="block text-xs text-steel-400">
                                CP {viaje.codigo_postal}
                              </span>
                            )}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(viaje.unidades ?? 0)}
                          </Td>
                          <Td align="right">
                            {cuantos > 0 ? (
                              <span className="font-semibold text-secondary-600">
                                {formatNumber(cuantos)}
                              </span>
                            ) : (
                              <span className="text-steel-300">—</span>
                            )}
                          </Td>
                        </tr>
                      )
                    })}
                  </Table>
                )}

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  Tocá un viaje para ver quién está cerca de ese destino. Cuentan
                  los pedidos confirmados y en producción con entrega por envío:
                  un presupuesto todavía no es un viaje, y un entregado ya
                  volvió.
                </p>
              </Card>

              {destino && (
                <Card
                  title={`Cerca de ${comoTexto(destino)}`}
                  className="mt-6"
                  actions={
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1.5 text-xs"
                      onClick={() => setDestino(null)}
                    >
                      Cerrar
                    </Button>
                  }
                >
                  {ordenados.length === 0 ? (
                    <Empty>
                      No hay nadie más cargado cerca de ese destino.
                    </Empty>
                  ) : (
                    <>
                      <Table
                        head={
                          <>
                            <Th>Quién</Th>
                            <Th>Por qué llamarlo</Th>
                            <Th>Dónde</Th>
                            <Th>Qué tan cerca</Th>
                            <Th align="right"> </Th>
                          </>
                        }
                      >
                        {ordenados.map((punto) => (
                          <Candidato key={`${punto.clase}-${punto.id}`} punto={punto} />
                        ))}
                      </Table>

                      {/* Qué quiere decir cada nivel. Sin esto, "misma zona"
                          parece una estimación de distancia y no lo es. */}
                      <dl className="divide-y divide-steel-100 border-t border-steel-200 bg-steel-50">
                        {Object.entries(CERCANIA_LABELS).map(([nivel, label]) => (
                          <div
                            key={nivel}
                            className="flex flex-wrap items-baseline gap-x-3 px-4 py-2"
                          >
                            <dt>
                              <Badge tone={CERCANIA_TONES[nivel]}>{label}</Badge>
                            </dt>
                            <dd className="text-xs text-steel-500">
                              {CERCANIA_HINTS[nivel]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}

                  <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                    El orden lo pone a quién conviene llamar primero: arriba los
                    leads que se perdieron por el costo del flete, que ya
                    quisieron comprar y los frenó justamente esto. No hay
                    kilómetros entre dos destinos porque el padrón de códigos
                    postales sólo guarda la distancia hasta la fábrica; lo que sí
                    es exacto es que dos destinos de la misma zona{' '}
                    <strong>le cuestan lo mismo al transporte</strong>.
                  </p>
                </Card>
              )}

              <Card title="La cartera por provincia" className="mt-6">
                {provincias.length === 0 ? (
                  <Empty>
                    Nadie tiene provincia cargada todavía. El código postal la
                    completa solo al cargar un lead.
                  </Empty>
                ) : (
                  <Table
                    head={
                      <>
                        <Th>Provincia</Th>
                        <Th align="right">Localidades</Th>
                        <Th align="right">Clientes</Th>
                        <Th align="right">Leads</Th>
                        <Th align="right">Perdidos por flete</Th>
                      </>
                    }
                  >
                    {provincias.map((fila) => {
                      const elegida =
                        destino?.provinciaClave === fila.clave

                      return (
                        <tr
                          key={fila.clave}
                          onClick={() =>
                            setDestino(
                              elegida
                                ? null
                                : {
                                    /* Una provincia como destino: sin código
                                       postal, así que la cuenta cae sola al
                                       nivel más flojo, que es el que
                                       corresponde. */
                                    provincia: fila.nombre,
                                    provinciaClave: fila.clave,
                                    localidad: null,
                                    codigo_postal: null,
                                  },
                            )
                          }
                          className={`cursor-pointer hover:bg-steel-50 ${
                            elegida ? 'bg-secondary-50' : ''
                          }`}
                        >
                          <Td className="font-medium text-steel-700">{fila.nombre}</Td>
                          <Td align="right" className="tabular-nums text-steel-500">
                            {formatNumber(fila.localidades)}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(fila.clientes)}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(fila.leads)}
                          </Td>
                          <Td align="right">
                            {fila.perdidosPorFlete > 0 ? (
                              <span className="font-semibold text-amber-600">
                                {formatNumber(fila.perdidosPorFlete)}
                              </span>
                            ) : (
                              <span className="text-steel-300">—</span>
                            )}
                          </Td>
                        </tr>
                      )
                    })}
                  </Table>
                )}

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  «Córdoba» y «Cordoba» cuentan como una sola: se agrupan sin
                  tildes y se muestra la grafía que más se usó. Para ver la lista
                  completa de una provincia están los filtros de{' '}
                  <Link to="/erp/clientes" className="font-semibold underline underline-offset-2">
                    Clientes
                  </Link>{' '}
                  y{' '}
                  <Link to="/erp/leads" className="font-semibold underline underline-offset-2">
                    Leads
                  </Link>
                  .
                </p>
              </Card>
            </>
          )
        }}
      </Async>
    </>
  )
}
