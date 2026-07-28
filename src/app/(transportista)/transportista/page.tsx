'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface ValeLinea {
  id: string
  cantidad_autorizada: number
  cantidad_retirada: number
  estado: string
  clientes: {
    nombre: string
    direccion: string
    localidad: string
    contacto_nombre: string
    contacto_telefono: string
  }
}

interface Vale {
  id: string
  numero: string
  estado: string
  fecha_creacion: string
  fecha_vencimiento: string | null
  notas: string | null
  vale_lineas: ValeLinea[]
}

function diasRestantes(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVenc)
  venc.setHours(0, 0, 0, 0)
  return Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function urgenciaColor(dias: number | null): { bg: string; text: string; label: string } {
  if (dias === null) return { bg: '#dce6ec', text: '#6a8494', label: 'Sin venc.' }
  if (dias < 0) return { bg: '#b04040', text: '#fff', label: `Vencido (${Math.abs(dias)}d)` }
  if (dias <= 3) return { bg: '#b04040', text: '#fff', label: `${dias}d restantes` }
  if (dias <= 7) return { bg: '#c49a3c', text: '#fff', label: `${dias}d restantes` }
  return { bg: '#2a9d6e', text: '#fff', label: `${dias}d restantes` }
}

function estadoChip(estado: string) {
  const colores: Record<string, { bg: string; text: string }> = {
    sin_asignar: { bg: '#dce6ec', text: '#6a8494' },
    asignado: { bg: '#2c6382', text: '#fff' },
    en_curso: { bg: '#c49a3c', text: '#fff' },
    parcial: { bg: '#c49a3c', text: '#fff' },
    completo: { bg: '#2a9d6e', text: '#fff' },
    cerrado: { bg: '#6a8494', text: '#fff' },
  }
  const c = colores[estado] || colores.sin_asignar
  const label = estado.replace('_', ' ')
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  )
}

export default function TransportistaValesPage() {
  const [vales, setVales] = useState<Vale[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos')
  const supabase = createClient()

  useEffect(() => {
    cargarVales()
  }, [])

  async function cargarVales() {
    setLoading(true)

    // Obtener transportista_id del usuario
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: perfil } = await supabase
      .from('users')
      .select('transportista_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.transportista_id) return

    const { data, error } = await supabase
      .from('vales')
      .select(`
        id, numero, estado, fecha_creacion, fecha_vencimiento, notas,
        vale_lineas (
          id, cantidad_autorizada, cantidad_retirada, estado,
          clientes ( nombre, direccion, localidad, contacto_nombre, contacto_telefono )
        )
      `)
      .eq('transportista_id', perfil.transportista_id)
      .neq('estado', 'revertido')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (!error && data) {
      setVales(data as unknown as Vale[])
    }
    setLoading(false)
  }

  const valesFiltrados = filtro === 'activos'
    ? vales.filter(v => !['completo', 'cerrado'].includes(v.estado))
    : vales

  // KPIs básicos
  const valesActivos = vales.filter(v => !['completo', 'cerrado'].includes(v.estado))
  const totalPendiente = valesActivos.reduce((sum, v) =>
    sum + v.vale_lineas.reduce((s, l) => s + (l.cantidad_autorizada - l.cantidad_retirada), 0), 0)
  const valesVencidos = valesActivos.filter(v => {
    const d = diasRestantes(v.fecha_vencimiento)
    return d !== null && d < 0
  }).length
  const valesUrgentes = valesActivos.filter(v => {
    const d = diasRestantes(v.fecha_vencimiento)
    return d !== null && d >= 0 && d <= 3
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: '#6a8494' }}>Cargando vales...</span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--ink)' }}>Vales asignados</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Vales activos" valor={valesActivos.length} />
        <KpiCard label="Pallets pendientes" valor={totalPendiente} />
        <KpiCard label="Vencidos" valor={valesVencidos} color={valesVencidos > 0 ? '#b04040' : undefined} />
        <KpiCard label="Urgentes (≤3d)" valor={valesUrgentes} color={valesUrgentes > 0 ? '#c49a3c' : undefined} />
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFiltro('activos')}
          className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: filtro === 'activos' ? '#2c6382' : '#dce6ec',
            color: filtro === 'activos' ? '#fff' : '#6a8494',
          }}>
          Activos
        </button>
        <button onClick={() => setFiltro('todos')}
          className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: filtro === 'todos' ? '#2c6382' : '#dce6ec',
            color: filtro === 'todos' ? '#fff' : '#6a8494',
          }}>
          Todos
        </button>
      </div>

      {/* Lista de vales */}
      {valesFiltrados.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: '#6a8494' }}>
          {filtro === 'activos' ? 'No hay vales activos.' : 'No hay vales asignados.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {valesFiltrados.map(vale => {
            const dias = diasRestantes(vale.fecha_vencimiento)
            const urg = urgenciaColor(dias)
            const totalAut = vale.vale_lineas.reduce((s, l) => s + l.cantidad_autorizada, 0)
            const totalRet = vale.vale_lineas.reduce((s, l) => s + l.cantidad_retirada, 0)
            const pctAvance = totalAut > 0 ? Math.round((totalRet / totalAut) * 100) : 0
            const abierto = expandido === vale.id

            return (
              <div key={vale.id} className="rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>

                {/* Cabecera del vale */}
                <button onClick={() => setExpandido(abierto ? null : vale.id)}
                  className="w-full text-left p-4 flex flex-col gap-2">

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{vale.numero}</span>
                    <div className="flex items-center gap-2">
                      {estadoChip(vale.estado)}
                      <span className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: urg.bg, color: urg.text }}>
                        {urg.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                    <span>{vale.vale_lineas.length} cliente{vale.vale_lineas.length !== 1 ? 's' : ''}</span>
                    <span>{totalRet} / {totalAut} pallets ({pctAvance}%)</span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pctAvance}%`, background: pctAvance >= 100 ? '#2a9d6e' : '#2c6382' }} />
                  </div>

                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                    <span>Creado: {new Date(vale.fecha_creacion).toLocaleDateString('es-AR')}</span>
                    {vale.fecha_vencimiento && (
                      <span>Vence: {new Date(vale.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
                    )}
                  </div>
                </button>

                {/* Detalle expandible: líneas del vale */}
                {abierto && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--line)' }}>
                    {vale.notas && (
                      <p className="text-xs mb-3 italic" style={{ color: 'var(--muted)' }}>
                        {vale.notas}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {vale.vale_lineas.map(linea => {
                        const pendiente = linea.cantidad_autorizada - linea.cantidad_retirada
                        return (
                          <div key={linea.id} className="p-3 rounded"
                            style={{ background: 'var(--surface-2)' }}>
                            <div className="flex items-start justify-between mb-1">
                              <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                                {linea.clientes.nombre}
                              </span>
                              <span className="text-xs font-medium px-2 py-0.5 rounded"
                                style={{
                                  background: pendiente === 0 ? '#2a9d6e' : '#2c6382',
                                  color: '#fff',
                                }}>
                                {pendiente === 0 ? 'Completo' : `${pendiente} pend.`}
                              </span>
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>
                              <p>{linea.clientes.direccion}, {linea.clientes.localidad}</p>
                              {linea.clientes.contacto_nombre && (
                                <p className="mt-1">
                                  {linea.clientes.contacto_nombre}
                                  {linea.clientes.contacto_telefono && ` · ${linea.clientes.contacto_telefono}`}
                                </p>
                              )}
                              <p className="mt-1">
                                Autorizado: {linea.cantidad_autorizada} · Retirado: {linea.cantidad_retirada}
                              </p>
                            </div>
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

function KpiCard({ label, valor, color }: { label: string; valor: number; color?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--ink)' }}>{valor}</p>
    </div>
  )
}
