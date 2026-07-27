'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface ClienteConsolidado {
  clienteId: string
  nombre: string
  direccion: string
  localidad: string
  contacto_nombre: string
  contacto_telefono: string
  contacto_email: string
  totalAutorizado: number
  totalRetirado: number
  totalPendiente: number
  vales: {
    valeId: string
    numero: string
    estado: string
    fechaVencimiento: string | null
    diasRestantes: number | null
    cantidadAutorizada: number
    cantidadRetirada: number
  }[]
}

function calcDiasRestantes(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVenc)
  venc.setHours(0, 0, 0, 0)
  return Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function urgenciaColor(dias: number | null): { bg: string; text: string } {
  if (dias === null) return { bg: '#dce6ec', text: '#6a8494' }
  if (dias < 0) return { bg: '#b04040', text: '#fff' }
  if (dias <= 3) return { bg: '#b04040', text: '#fff' }
  if (dias <= 7) return { bg: '#c49a3c', text: '#fff' }
  return { bg: '#2a9d6e', text: '#fff' }
}

export default function TransportistaClientesPage() {
  const [clientes, setClientes] = useState<ClienteConsolidado[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const supabase = createClient()

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: perfil } = await supabase
      .from('users')
      .select('transportista_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.transportista_id) return

    // Traer vale_lineas con datos de vale y cliente
    const { data, error } = await supabase
      .from('vale_lineas')
      .select(`
        id, cantidad_autorizada, cantidad_retirada, estado,
        clientes ( id, nombre, direccion, localidad, contacto_nombre, contacto_telefono, contacto_email ),
        vales!inner ( id, numero, estado, fecha_vencimiento, transportista_id )
      `)
      .eq('vales.transportista_id', perfil.transportista_id)
      .neq('vales.estado', 'revertido')

    if (error || !data) {
      setLoading(false)
      return
    }

    // Filtrar solo vales activos (no completos ni cerrados)
    const lineasActivas = data.filter((l: any) =>
      !['completo', 'cerrado'].includes(l.vales.estado)
    )

    // Agrupar por cliente
    const mapa = new Map<string, ClienteConsolidado>()

    for (const linea of lineasActivas as any[]) {
      const c = linea.clientes
      const v = linea.vales
      const key = c.id

      if (!mapa.has(key)) {
        mapa.set(key, {
          clienteId: c.id,
          nombre: c.nombre,
          direccion: c.direccion || '',
          localidad: c.localidad || '',
          contacto_nombre: c.contacto_nombre || '',
          contacto_telefono: c.contacto_telefono || '',
          contacto_email: c.contacto_email || '',
          totalAutorizado: 0,
          totalRetirado: 0,
          totalPendiente: 0,
          vales: [],
        })
      }

      const cli = mapa.get(key)!
      cli.totalAutorizado += linea.cantidad_autorizada
      cli.totalRetirado += linea.cantidad_retirada
      cli.totalPendiente += (linea.cantidad_autorizada - linea.cantidad_retirada)

      // Evitar duplicar el mismo vale si tiene múltiples líneas del mismo cliente (no debería pasar, pero por seguridad)
      if (!cli.vales.find(vv => vv.valeId === v.id)) {
        cli.vales.push({
          valeId: v.id,
          numero: v.numero,
          estado: v.estado,
          fechaVencimiento: v.fecha_vencimiento,
          diasRestantes: calcDiasRestantes(v.fecha_vencimiento),
          cantidadAutorizada: linea.cantidad_autorizada,
          cantidadRetirada: linea.cantidad_retirada,
        })
      } else {
        // Sumar cantidades al vale ya existente
        const valeExistente = cli.vales.find(vv => vv.valeId === v.id)!
        valeExistente.cantidadAutorizada += linea.cantidad_autorizada
        valeExistente.cantidadRetirada += linea.cantidad_retirada
      }
    }

    // Ordenar clientes por pendiente descendente
    const resultado = Array.from(mapa.values()).sort((a, b) => b.totalPendiente - a.totalPendiente)

    // Dentro de cada cliente, ordenar vales por urgencia
    for (const cli of resultado) {
      cli.vales.sort((a, b) => {
        if (a.diasRestantes === null && b.diasRestantes === null) return 0
        if (a.diasRestantes === null) return 1
        if (b.diasRestantes === null) return -1
        return a.diasRestantes - b.diasRestantes
      })
    }

    setClientes(resultado)
    setLoading(false)
  }

  const clientesFiltrados = busqueda
    ? clientes.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.localidad.toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: '#6a8494' }}>Cargando clientes...</span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--ink)' }}>Pendiente por cliente</h1>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar cliente o localidad..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full max-w-md px-3 py-2 rounded text-sm border outline-none focus:ring-2 mb-6"
        style={{ background: '#fff', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />

      {clientesFiltrados.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: '#6a8494' }}>
          {busqueda ? 'No se encontraron clientes.' : 'No hay retiros pendientes.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {clientesFiltrados.map(cli => {
            const abierto = expandido === cli.clienteId
            const pctAvance = cli.totalAutorizado > 0
              ? Math.round((cli.totalRetirado / cli.totalAutorizado) * 100) : 0

            // Urgencia del cliente = la del vale más urgente
            const minDias = cli.vales.reduce((min, v) => {
              if (v.diasRestantes === null) return min
              if (min === null) return v.diasRestantes
              return v.diasRestantes < min ? v.diasRestantes : min
            }, null as number | null)

            return (
              <div key={cli.clienteId} className="rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>

                <button onClick={() => setExpandido(abierto ? null : cli.clienteId)}
                  className="w-full text-left p-4 flex flex-col gap-2">

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                      {cli.nombre}
                    </span>
                    <span className="text-lg font-bold" style={{ color: cli.totalPendiente > 0 ? 'var(--ink)' : '#2a9d6e' }}>
                      {cli.totalPendiente}
                      <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>pend.</span>
                    </span>
                  </div>

                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {cli.direccion}{cli.localidad ? `, ${cli.localidad}` : ''}
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pctAvance}%`, background: pctAvance >= 100 ? '#2a9d6e' : '#2c6382' }} />
                  </div>

                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                    <span>{cli.vales.length} vale{cli.vales.length !== 1 ? 's' : ''} · {cli.totalRetirado}/{cli.totalAutorizado} pallets</span>
                    {minDias !== null && (
                      <span className="px-2 py-0.5 rounded font-semibold"
                        style={urgenciaColor(minDias)}>
                        {minDias < 0 ? `Vencido (${Math.abs(minDias)}d)` : `${minDias}d`}
                      </span>
                    )}
                  </div>
                </button>

                {/* Detalle expandible */}
                {abierto && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--line)' }}>

                    {/* Contacto */}
                    {(cli.contacto_nombre || cli.contacto_telefono || cli.contacto_email) && (
                      <div className="text-xs mb-3 p-2 rounded" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                        {cli.contacto_nombre && <span className="font-medium">{cli.contacto_nombre}</span>}
                        {cli.contacto_telefono && <span> · {cli.contacto_telefono}</span>}
                        {cli.contacto_email && <span> · {cli.contacto_email}</span>}
                      </div>
                    )}

                    {/* Vales de este cliente */}
                    <div className="flex flex-col gap-2">
                      {cli.vales.map(v => {
                        const pendiente = v.cantidadAutorizada - v.cantidadRetirada
                        const urg = urgenciaColor(v.diasRestantes)
                        return (
                          <div key={v.valeId} className="p-3 rounded flex items-center justify-between"
                            style={{ background: 'var(--surface-2)' }}>
                            <div>
                              <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                                {v.numero}
                              </span>
                              <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>
                                {v.cantidadRetirada}/{v.cantidadAutorizada} · {pendiente > 0 ? `${pendiente} pend.` : 'Completo'}
                              </span>
                            </div>
                            {v.fechaVencimiento && (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold"
                                style={{ background: urg.bg, color: urg.text }}>
                                {v.diasRestantes !== null && v.diasRestantes < 0
                                  ? `Vencido`
                                  : new Date(v.fechaVencimiento).toLocaleDateString('es-AR')}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
