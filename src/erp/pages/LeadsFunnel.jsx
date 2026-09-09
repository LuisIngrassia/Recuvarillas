/**
 * Las métricas del embudo.
 *
 * Todo lo de acá se calcula sobre el historial (`lead_events`) y no sobre el
 * estado actual de cada lead. La diferencia es la que hace que el panel sirva:
 * un lead perdido hoy dice "perdido" y nada más, pero su historia cuenta que
 * llegó a estar por cerrar, y ahí está el dato que importa —dónde se cae la
 * venta—.
 *
 * Sobre cómo está dibujado, tres decisiones que se toman una vez y ordenan todo:
 *
 * - **Los números sueltos no llevan gráfico.** La tasa de cierre o el ticket
 *   promedio son un número; un gráfico de una sola barra los haría más difíciles
 *   de leer, no más fáciles.
 * - **Las comparaciones van en barras horizontales de un solo tono.** Ninguna de
 *   estas series es de identidad —no hay que distinguir "canal A" de "canal B"
 *   por color, están escritos al lado—, así que el color sólo mide magnitud y
 *   alcanza con un tono. Un color por etapa sería ruido que además se rompe para
 *   quien no distingue colores.
 * - **Canal y tipo van en tabla.** Son diez canales: pasado el séptimo, una
 *   tabla se lee mejor que cualquier gráfico.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATES_ACTIVE,
  LEAD_STATE_LABELS,
  LEAD_TYPE_LABELS,
  LOST_REASON_LABELS,
  conversionPorEtapa,
  loadFunnelMetrics,
} from '../api/leads'
import {
  Async,
  Button,
  Card,
  Empty,
  Input,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'
import { currentMonth, formatNumber, formatPesos } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/**
 * Una barra horizontal con su valor escrito al lado.
 *
 * El valor va como texto y no sólo como largo de barra: leer un número exacto
 * de una barra es imposible, y son pocas filas, así que etiquetarlas todas se
 * puede. La barra queda para comparar de un vistazo, que es lo único que un
 * dibujo hace mejor que una tabla.
 */
function Barra({ label, valor, maximo, detalle }) {
  const ancho = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0

  return (
    <div className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
      <span className="truncate text-xs text-steel-600">{label}</span>

      <span className="h-2.5 rounded-full bg-steel-100">
        <span
          className="block h-2.5 rounded-full bg-secondary-500"
          style={{ width: `${ancho}%` }}
        />
      </span>

      <span className="tabular-nums text-right text-xs font-semibold text-steel-700">
        {valor}
        {detalle && <span className="ml-1 font-normal text-steel-400">{detalle}</span>}
      </span>
    </div>
  )
}

function Barras({ filas }) {
  const maximo = Math.max(0, ...filas.map((f) => f.valor))

  if (!filas.length || maximo === 0) return <Empty>Todavía no hay datos.</Empty>

  return (
    <div className="space-y-2.5 px-4 py-4">
      {filas.map((fila) => (
        <Barra key={fila.label} {...fila} maximo={maximo} />
      ))}
    </div>
  )
}

const porcentaje = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`)

export default function LeadsFunnel() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState(currentMonth())

  const query = useAsync(
    () => loadFunnelMetrics({ desde: desde ? `${desde}-01` : null, hasta: hasta ? `${hasta}-01` : null }),
    [desde, hasta],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Embudo"
        description="Dónde se cae la venta, calculado sobre el historial de cada lead."
        actions={
          <Link to="/erp/leads/tablero">
            <Button variant="ghost">Tablero</Button>
          </Link>
        }
      />

      <Async query={query}>
        {(m) => {
          const conversion = conversionPorEtapa(m)

          const ganados = m.resultados.reduce((s, r) => s + r.ganados, 0)
          const perdidos = m.resultados.reduce((s, r) => s + r.perdidos, 0)
          const facturado = m.resultados.reduce((s, r) => s + Number(r.facturado), 0)
          const abiertos = m.resultados.reduce((s, r) => s + r.abiertos, 0)
          const cierre = ganados + perdidos > 0 ? ganados / (ganados + perdidos) : null
          const reac = m.reactivaciones ?? {}

          /* Canal y tipo se agrupan acá y no en la base porque la vista está
             abierta por mes: la pantalla mira un rango. */
          const agrupar = (campo) => {
            const mapa = new Map()
            for (const r of m.resultados) {
              const clave = r[campo] ?? 'sin_definir'
              const actual = mapa.get(clave) ?? { clave, leads: 0, ganados: 0, perdidos: 0, facturado: 0 }
              actual.leads += r.leads
              actual.ganados += r.ganados
              actual.perdidos += r.perdidos
              actual.facturado += Number(r.facturado)
              mapa.set(clave, actual)
            }
            return [...mapa.values()].sort((a, b) => b.leads - a.leads)
          }

          const motivos = (() => {
            const mapa = new Map()
            for (const p of m.perdidas) {
              mapa.set(p.lost_reason, (mapa.get(p.lost_reason) ?? 0) + p.leads)
            }
            return [...mapa.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([motivo, leads]) => ({
                label: LOST_REASON_LABELS[motivo] ?? motivo,
                valor: leads,
              }))
          })()

          return (
            <>
              {/* Los filtros van en una fila arriba de todo, no repartidos por sección. */}
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-steel-600">
                  Desde
                  <Input
                    type="month"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="mt-1 w-auto"
                  />
                </label>
                <label className="text-xs font-semibold text-steel-600">
                  Hasta
                  <Input
                    type="month"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="mt-1 w-auto"
                  />
                </label>
                <p className="pb-2 text-xs text-steel-400">
                  El rango afecta a los resultados y a los motivos de pérdida. El embudo y los
                  tiempos son de todo el historial.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Tasa de cierre"
                  value={porcentaje(cierre)}
                  hint={`${formatNumber(ganados)} ganados de ${formatNumber(ganados + perdidos)} cerrados`}
                  tone={cierre !== null && cierre >= 0.3 ? 'good' : 'neutral'}
                />
                <Stat
                  label="Ticket promedio"
                  value={ganados ? formatPesos(facturado / ganados) : '—'}
                  hint="De los leads ganados en el rango"
                />
                <Stat
                  label="Abiertos"
                  value={formatNumber(abiertos)}
                  hint="Leads todavía en juego"
                />
                <Stat
                  label="Reactivación"
                  value={
                    reac.intentados
                      ? porcentaje((reac.reactivados ?? 0) / reac.intentados)
                      : '—'
                  }
                  hint={
                    reac.intentados
                      ? `${reac.reactivados} de ${reac.intentados} recontactados volvieron a moverse · ${reac.ganados ?? 0} compraron`
                      : 'Todavía no se recontactó a nadie'
                  }
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Embudo — cuántos llegaron a cada etapa">
                  <Barras
                    filas={conversion.map((c) => ({
                      label: LEAD_STATE_LABELS[c.status],
                      valor: c.llegaron,
                      detalle: c.conversion === null ? '' : `· ${porcentaje(c.conversion)} sigue`,
                    }))}
                  />
                  <p className="border-t border-steel-100 px-4 py-3 text-xs text-steel-400">
                    El porcentaje es cuántos de los que llegaron a esa etapa avanzaron a la
                    siguiente. Donde cae fuerte, ahí se traba el embudo.
                  </p>
                </Card>

                <Card title="Cuánto se tarda en salir de cada etapa">
                  <Barras
                    filas={LEAD_STATES_ACTIVE.map((status) => {
                      const t = m.tiempos.find((x) => x.status === status)
                      return {
                        label: LEAD_STATE_LABELS[status],
                        valor: t ? Number(t.dias_promedio) : 0,
                        detalle: 'días',
                      }
                    })}
                  />
                </Card>

                <Card title="Por qué se pierden">
                  <Barras filas={motivos} />
                  <p className="border-t border-steel-100 px-4 py-3 text-xs text-steel-400">
                    Es el dato que dice si el problema es el precio, el flete o el producto —y
                    cuál de los tres conviene atacar primero.
                  </p>
                </Card>

                <Card title="Por canal">
                  {agrupar('source').length === 0 ? (
                    <Empty>Todavía no hay datos.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Canal</Th>
                          <Th align="right">Leads</Th>
                          <Th align="right">Ganados</Th>
                          <Th align="right">Cierre</Th>
                          <Th align="right">Facturado</Th>
                        </>
                      }
                    >
                      {agrupar('source').map((f) => (
                        <tr key={f.clave}>
                          <Td>{LEAD_SOURCE_LABELS[f.clave] ?? f.clave}</Td>
                          <Td align="right" className="tabular-nums">
                            {formatNumber(f.leads)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {formatNumber(f.ganados)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {porcentaje(f.leads ? f.ganados / f.leads : null)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {formatPesos(f.facturado)}
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>

                <Card title="Por tipo de cliente">
                  {agrupar('lead_type').length === 0 ? (
                    <Empty>Todavía no hay datos.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Tipo</Th>
                          <Th align="right">Leads</Th>
                          <Th align="right">Ganados</Th>
                          <Th align="right">Cierre</Th>
                          <Th align="right">Ticket</Th>
                        </>
                      }
                    >
                      {agrupar('lead_type').map((f) => (
                        <tr key={f.clave}>
                          <Td>{LEAD_TYPE_LABELS[f.clave] ?? 'Sin definir'}</Td>
                          <Td align="right" className="tabular-nums">
                            {formatNumber(f.leads)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {formatNumber(f.ganados)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {porcentaje(f.leads ? f.ganados / f.leads : null)}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {f.ganados ? formatPesos(f.facturado / f.ganados) : '—'}
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
