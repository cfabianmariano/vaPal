'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface HojaConDetalles {
  id: string
  fecha: string
  estado: string
  notas: string | null
  created_at: string
  chofer: { nombre: string } | null
  camion: { patente: string; descripcion: string | null } | null
  visitas: {
    id: string
    cantidad_planificada: number
    cantidad_retirada: number
    estado: string
    orden: number
    cliente: {
      nombre: string
      localidad: string | null
      direccion: string | null
      contacto_nombre: string | null
      contacto_telefono: string | null
    } | null
  }[]
}

const estadoChip: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: 'var(--surface-2)', color: 'var(--muted)', label: 'Borrador' },
  definitiva: { bg: '#d4edda', color: 'var(--green-dark)', label: 'Definitiva' },
  en_ejecucion: { bg: '#fff3cd', color: '#856404', label: 'En ejecución' },
  finalizada: { bg: '#e0eaf0', color: 'var(--ink)', label: 'Finalizada' },
}

export default function HojasPage() {
  const router = useRouter()
  const [hojas, setHojas] = useState<HojaConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activas' | 'todas'>('activas')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    cargarHojas()
  }, [filtro])

  const cargarHojas = async () => {
    setLoading(true)

    // Get transportista_id of logged-in user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('transportista_id')
      .eq('id', user.id)
      .single()

    if (!userData?.transportista_id) return

    let query = supabase
      .from('hojas_ruta')
      .select(`
        id, fecha, estado, notas, created_at,
        chofer:users!hojas_ruta_chofer_id_fkey(nombre),
        camion:camiones(patente, descripcion),
        visitas:hoja_ruta_visitas(
          id, cantidad_planificada, cantidad_retirada, estado, orden,
          cliente:clientes(nombre, localidad, direccion, contacto_nombre, contacto_telefono)
        )
      `)
      .eq('transportista_id', userData.transportista_id)
      .order('fecha', { ascending: false })

    if (filtro === 'activas') {
      query = query.in('estado', ['borrador', 'definitiva', 'en_ejecucion'])
    }

    const { data, error } = await query

    if (!error && data) {
      // Sort visitas by orden within each hoja
      const sorted = (data as unknown as HojaConDetalles[]).map((h) => ({
        ...h,
        visitas: [...(h.visitas || [])].sort((a, b) => a.orden - b.orden),
      }))
      setHojas(sorted)
    }
    setLoading(false)
  }

  const hoy = new Date().toISOString().split('T')[0]

  // KPIs
  const borradores = hojas.filter((h) => h.estado === 'borrador').length
  const activas = hojas.filter((h) => ['definitiva', 'en_ejecucion'].includes(h.estado)).length
  const hoyCount = hojas.filter((h) => h.fecha === hoy && h.estado !== 'borrador').length
  const totalPallets = hojas
    .filter((h) => ['definitiva', 'en_ejecucion'].includes(h.estado))
    .reduce((sum, h) => sum + h.visitas.reduce((s, v) => s + v.cantidad_planificada, 0), 0)

  const confirmarHoja = async (hojaId: string) => {
    const { error } = await supabase
      .from('hojas_ruta')
      .update({ estado: 'definitiva', updated_at: new Date().toISOString() })
      .eq('id', hojaId)
      .eq('estado', 'borrador')

    if (!error) cargarHojas()
  }

  const eliminarBorrador = async (hojaId: string) => {
    if (!confirm('¿Eliminar este borrador? Se liberan las cantidades reservadas.')) return

    // CASCADE deletes visitas and imputaciones
    const { error } = await supabase
      .from('hojas_ruta')
      .delete()
      .eq('id', hojaId)
      .eq('estado', 'borrador')

    if (!error) cargarHojas()
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Hojas de ruta
        </h1>
        <button
          onClick={() => router.push('/transportista/hojas/nueva')}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          + Nueva hoja
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Borradores', value: borradores, color: 'var(--muted)' },
          { label: 'Activas', value: activas, color: 'var(--green)' },
          { label: 'Hoy', value: hoyCount, color: 'var(--blue)' },
          { label: 'Pallets plan.', value: totalPallets, color: 'var(--ink)' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '0.75rem',
              textAlign: 'center',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['activas', 'todas'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: filtro === f ? 600 : 400,
              background: filtro === f ? 'var(--ink)' : 'var(--surface)',
              color: filtro === f ? '#fff' : 'var(--muted)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {f === 'activas' ? 'Activas' : 'Todas'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Cargando...</div>
      ) : hojas.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--line)',
            color: 'var(--muted)',
          }}
        >
          <p style={{ marginBottom: '1rem' }}>No hay hojas de ruta {filtro === 'activas' ? 'activas' : ''}</p>
          <button
            onClick={() => router.push('/transportista/hojas/nueva')}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {hojas.map((hoja) => {
            const isExpanded = expandido === hoja.id
            const totalPlan = hoja.visitas.reduce((s, v) => s + v.cantidad_planificada, 0)
            const totalRet = hoja.visitas.reduce((s, v) => s + v.cantidad_retirada, 0)
            const chip = estadoChip[hoja.estado] || estadoChip.borrador
            const fechaStr = new Date(hoja.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
            const esHoy = hoja.fecha === hoy

            return (
              <div
                key={hoja.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 8,
                  border: `1px solid ${esHoy ? 'var(--green)' : 'var(--line)'}`,
                  overflow: 'hidden',
                }}
              >
                {/* Header row */}
                <button
                  onClick={() => setExpandido(isExpanded ? null : hoja.id)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Date */}
                  <div style={{ minWidth: 80 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>{fechaStr}</div>
                    {esHoy && <div style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600 }}>HOY</div>}
                  </div>

                  {/* Chofer + camión */}
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                      {hoja.chofer?.nombre || '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {hoja.camion ? `${hoja.camion.patente}` : 'Sin camión'}
                      {' · '}{hoja.visitas.length} visita{hoja.visitas.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Quantities */}
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>
                      {totalRet}/{totalPlan}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>pallets</div>
                  </div>

                  {/* Estado chip */}
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: chip.bg,
                      color: chip.color,
                    }}
                  >
                    {chip.label}
                  </span>

                  {/* Expand arrow */}
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--line)' }}>
                    {/* Progress bar */}
                    <div style={{ margin: '0.75rem 0 0.5rem' }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 3,
                            width: totalPlan > 0 ? `${Math.min(100, (totalRet / totalPlan) * 100)}%` : '0%',
                            background: totalRet >= totalPlan ? 'var(--green)' : 'var(--blue)',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>

                    {/* Visitas */}
                    {hoja.visitas.map((v, i) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0',
                          borderBottom: i < hoja.visitas.length - 1 ? '1px solid var(--line)' : 'none',
                        }}
                      >
                        {/* Order number */}
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: v.estado === 'completada' ? 'var(--green)' : v.estado === 'en_curso' ? 'var(--blue)' : 'var(--line)',
                            color: v.estado === 'pendiente' ? 'var(--muted)' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {v.estado === 'completada' ? '✓' : v.orden}
                        </div>

                        {/* Client info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink)' }}>
                            {v.cliente?.nombre || '—'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {v.cliente?.localidad || ''}
                            {v.cliente?.contacto_nombre ? ` · ${v.cliente.contacto_nombre}` : ''}
                            {v.cliente?.contacto_telefono ? ` · ${v.cliente.contacto_telefono}` : ''}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
                            {v.cantidad_retirada}/{v.cantidad_planificada}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Notas */}
                    {hoja.notas && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                        {hoja.notas}
                      </div>
                    )}

                    {/* Actions for borrador */}
                    {hoja.estado === 'borrador' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          onClick={() => confirmarHoja(hoja.id)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'var(--green)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => router.push(`/transportista/hojas/editar/${hoja.id}`)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'var(--surface-2)',
                            color: 'var(--ink)',
                            border: '1px solid var(--line)',
                            borderRadius: 6,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarBorrador(hoja.id)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'none',
                            color: 'var(--red)',
                            border: '1px solid var(--red)',
                            borderRadius: 6,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
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
