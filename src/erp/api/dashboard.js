/**
 * Los números del panel de entrada.
 *
 * Cada consulta es chica y van todas juntas: son seis preguntas distintas y no
 * hay forma honesta de contestarlas con una sola. Van en paralelo para que el
 * panel no tarde la suma de las seis.
 */
import { db, unwrap } from './client'

/** Primer día del mes corriente, en el formato de fecha que usa Postgres. */
function startOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/** Pedidos que ya son ventas: ni presupuesto sin cerrar, ni anulados. */
const REAL_ORDERS = ['confirmado', 'en_produccion', 'entregado']

export async function loadDashboard() {
  const desde = startOfMonth()

  const [
    nuevos,
    enCurso,
    cobranzas,
    mes,
    stock,
    ultimosLeads,
    ultimosPedidos,
    agenda,
    finanzas,
  ] = await Promise.all([
      db()
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'nuevo')
        .then(({ count, error }) => unwrap({ data: count ?? 0, error })),

      db()
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['confirmado', 'en_produccion'])
        .then(({ count, error }) => unwrap({ data: count ?? 0, error })),

      // El saldo se suma acá y no en la base porque son pocas filas y así se
      // evita otra vista sólo para un total.
      db()
        .from('orders_summary')
        .select('saldo')
        .in('estado', REAL_ORDERS)
        .then((res) => unwrap(res).reduce((sum, row) => sum + Number(row.saldo), 0)),

      db()
        .from('orders_summary')
        .select('total, unidades')
        .in('estado', REAL_ORDERS)
        .gte('fecha', desde)
        .then((res) =>
          unwrap(res).reduce(
            (acc, row) => ({
              facturado: acc.facturado + Number(row.total),
              unidades: acc.unidades + Number(row.unidades),
            }),
            { facturado: 0, unidades: 0 },
          ),
        ),

      db().from('stock_actual').select('*').order('codigo').then(unwrap),

      db()
        .from('leads')
        .select('id, nombre, telefono, cantidad, agujereada, mercaderia, estado, created_at')
        .order('created_at', { ascending: false })
        .limit(6)
        .then(unwrap),

      db()
        .from('orders_summary')
        .select('id, numero, cliente_nombre, estado, fecha, total, saldo')
        .order('numero', { ascending: false })
        .limit(6)
        .then(unwrap),

      /*
        Lo que hay que despachar o entregar por mostrador. Ordenado por fecha de
        entrega y con los "a confirmar" al final: lo que tiene día se agenda,
        lo que no, se llama. Sin tope de fecha a propósito —también tienen que
        aparecer los que se pasaron— y sólo los pedidos vivos, porque un
        entregado ya no espera a nadie.
      */
      db()
        .from('orders_summary')
        .select(
          'id, numero, cliente_nombre, cliente_telefono, estado, entrega, localidad, provincia, codigo_postal, fecha, fecha_entrega, unidades, saldo',
        )
        .in('estado', ['confirmado', 'en_produccion'])
        .order('fecha_entrega', { ascending: true, nullsFirst: false })
        .limit(20)
        .then(unwrap),

      /*
        El resultado del mes ya calculado. Un mes sin ventas ni gastos no tiene
        fila, y eso no es un error: `maybeSingle` devuelve null y la pantalla
        muestra ceros.
      */
      db()
        .from('finanzas_mensuales')
        .select('*')
        .eq('mes', desde)
        .maybeSingle()
        .then(unwrap),
    ])

  return {
    nuevos,
    enCurso,
    cobranzas,
    mes,
    stock,
    ultimosLeads,
    ultimosPedidos,
    agenda,
    finanzas,
  }
}
