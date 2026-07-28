'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface VLP {
  vale_linea_id: string
  vale_id: string
  cliente_id: string
  vale_numero: string
  fecha_vencimiento: string | null
  cantidad_autorizada: number
  cantidad_retirada: number
  pendiente: number
  reservado_en_hojas: number
  planificable: number
}

interface ClienteAgrupado {
  cliente_id: string
  nombre: string
  localidad: string | null
  direccion: string | null
  total_planificable: number
  lineas: VLP[]
}

interface Chofer {
  id: string
  nombre: string
}

interface Camion {
  id: string
  patente: string
  descripcion: string | null
}

interface VisitaForm {
  cliente_id: string
  nombre: string
  localidad: string | null
  cantidad: number
  max: number
  orden: number
  imputaciones: { vale_linea_id: string; cantidad_imputada: number; vale_numero: string; fecha_vencimiento: string | null }[]
}

function distribuirFEFO(lineas: VLP[], cantidadSolicitada: number) {
  const sorted = [...lineas].sort((a, b) =>
    (a.fecha_vencimiento || '9999-12-31').localeCompare(b.fecha_vencimiento || '9999-12-31')
  )

  const imputaciones: { vale_linea_id: string; cantidad_imputada: number; vale_numero: string; fecha_vencimiento: string | null }[] = []
  let restante = cantidadSolicitada

  for (const vl of sorted) {
    if (restante <= 0) break
    if (vl.planificable <= 0) continue

    const imputar = Math.min(restante, vl.planificable)
    imputaciones.push({
      vale_linea_id: vl.vale_linea_id,
      cantidad_imputada: imputar,
      vale_numero: vl.vale_numero,
      fecha_vencimiento: vl.fecha_vencimiento,
    })
    restante -= imputar
  }

  return { imputaciones, sobrante: restante }
}

export default function NuevaHojaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transportistaId, setTransportistaId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')

  // Form fields
  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1) // default: tomorrow
    return d.toISOString().split('T')[0]
  })
  const [choferId, setChoferId] = useState('')
  const [camionId, setCamionId] = useState('')
  const [notas, setNotas] = useState('')

  // Data
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [clientesDisp, setClientesDisp] = useState<ClienteAgrupado[]>([])
  const [visitas, setVisitas] = useState<VisitaForm[]>([])

  // Step: 'config' (date/chofer/camion) | 'visitas' (add clients)
  const [step, setStep] = useState<'config' | 'visitas'>('config')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: userData } = await supabase
      .from('users')
      .select('transportista_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.transportista_id) return
    setTransportistaId(userData.transportista_id)
    setOrgId(userData.organization_id)

    // Choferes of this transportista
    const { data: choferesData } = await supabase
      .from('users')
      .select('id, nombre')
      .eq('transportista_id', userData.transportista_id)
      .eq('role', 'chofer')
      .eq('activo', true)

    setChoferes(choferesData || [])

    // Camiones of this transportista
    const { data: camionesData } = await supabase
      .from('camiones')
      .select('id, patente, descripcion')
      .eq('transportista_id', userData.transportista_id)
      .eq('activo', true)

    setCamiones(camionesData || [])

    // Planificable vale_lineas for this transportista
    const { data: vlpData } = await supabase
      .from('vale_linea_planificable')
      .select('*')
      .eq('transportista_id', userData.transportista_id)
      .gt('planificable', 0)

    if (vlpData) {
      // Group by client, get client names
      const clienteIds = [...new Set(vlpData.map((v: VLP) => v.cliente_id))]

      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre, localidad, direccion')
        .in('id', clienteIds)

      const clienteMap = new Map((clientesData || []).map((c: { id: string; nombre: string; localidad: string | null; direccion: string | null }) => [c.id, c]))

      const agrupados: ClienteAgrupado[] = clienteIds.map((cid: string) => {
        const lineas = vlpData.filter((v: VLP) => v.cliente_id === cid)
        const cliente = clienteMap.get(cid)
        return {
          cliente_id: cid,
          nombre: cliente?.nombre || '—',
          localidad: cliente?.localidad || null,
          direccion: cliente?.direccion || null,
          total_planificable: lineas.reduce((s: number, l: VLP) => s + l.planificable, 0),
          lineas,
        }
      })

      // Sort by oldest vencimiento (FEFO hint)
      agrupados.sort((a, b) => {
        const aMin = Math.min(...a.lineas.map((l) => new Date(l.fecha_vencimiento || '9999-12-31').getTime()))
        const bMin = Math.min(...b.lineas.map((l) => new Date(l.fecha_vencimiento || '9999-12-31').getTime()))
        return aMin - bMin
      })

      setClientesDisp(agrupados)
    }

    setLoading(false)
  }

  const agregarVisita = (cliente: ClienteAgrupado) => {
    if (visitas.find((v) => v.cliente_id === cliente.cliente_id)) return

    const nuevaVisita: VisitaForm = {
      cliente_id: cliente.cliente_id,
      nombre: cliente.nombre,
      localidad: cliente.localidad,
      cantidad: cliente.total_planificable, // default: all available
      max: cliente.total_planificable,
      orden: visitas.length + 1,
      imputaciones: distribuirFEFO(cliente.lineas, cliente.total_planificable).imputaciones,
    }

    setVisitas([...visitas, nuevaVisita])
  }

  const quitarVisita = (clienteId: string) => {
    const nuevas = visitas
      .filter((v) => v.cliente_id !== clienteId)
      .map((v, i) => ({ ...v, orden: i + 1 }))
    setVisitas(nuevas)
  }

  const actualizarCantidad = (clienteId: string, cantidad: number) => {
    const cliente = clientesDisp.find((c) => c.cliente_id === clienteId)
    if (!cliente) return

    const cantFinal = Math.max(0, Math.min(cantidad, cliente.total_planificable))
    const { imputaciones } = distribuirFEFO(cliente.lineas, cantFinal)

    setVisitas(
      visitas.map((v) =>
        v.cliente_id === clienteId
          ? { ...v, cantidad: cantFinal, imputaciones }
          : v
      )
    )
  }

  const moverVisita = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= visitas.length) return

    const newVisitas = [...visitas]
    const temp = newVisitas[index]
    newVisitas[index] = newVisitas[newIndex]
    newVisitas[newIndex] = temp

    setVisitas(newVisitas.map((v, i) => ({ ...v, orden: i + 1 })))
  }

  const guardar = async (estado: 'borrador' | 'definitiva') => {
    if (!choferId) { alert('Seleccioná un chofer'); return }
    if (visitas.length === 0) { alert('Agregá al menos una visita'); return }
    if (visitas.some((v) => v.cantidad <= 0)) { alert('Todas las visitas deben tener cantidad mayor a 0'); return }

    setSaving(true)

    try {
      // 1. Create hoja_ruta
      const { data: hoja, error: hojaErr } = await supabase
        .from('hojas_ruta')
        .insert({
          organization_id: orgId,
          transportista_id: transportistaId,
          chofer_id: choferId,
          camion_id: camionId || null,
          fecha,
          estado,
          notas: notas || null,
          created_by: userId,
        })
        .select('id')
        .single()

      if (hojaErr || !hoja) throw new Error(hojaErr?.message || 'Error al crear hoja')

      // 2. Create visitas
      const visitasInsert = visitas.map((v) => ({
        hoja_ruta_id: hoja.id,
        cliente_id: v.cliente_id,
        cantidad_planificada: v.cantidad,
        orden: v.orden,
        estado: 'pendiente',
      }))

      const { data: visitasData, error: visitasErr } = await supabase
        .from('hoja_ruta_visitas')
        .insert(visitasInsert)
        .select('id, cliente_id')

      if (visitasErr || !visitasData) throw new Error(visitasErr?.message || 'Error al crear visitas')

      // 3. Create imputaciones
      const imputacionesInsert: { visita_id: string; vale_linea_id: string; cantidad_imputada: number }[] = []

      for (const visita of visitas) {
        const dbVisita = visitasData.find((dv: { id: string; cliente_id: string }) => dv.cliente_id === visita.cliente_id)
        if (!dbVisita) continue

        for (const imp of visita.imputaciones) {
          imputacionesInsert.push({
            visita_id: dbVisita.id,
            vale_linea_id: imp.vale_linea_id,
            cantidad_imputada: imp.cantidad_imputada,
          })
        }
      }

      if (imputacionesInsert.length > 0) {
        const { error: impErr } = await supabase
          .from('hoja_imputaciones')
          .insert(imputacionesInsert)

        if (impErr) throw new Error(impErr.message)
      }

      router.push('/transportista/hojas')
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Cargando...</div>
  }

  const totalPallets = visitas.reduce((s, v) => s + v.cantidad, 0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '1.25rem' }}>
        Nueva hoja de ruta
      </h1>

      {/* Step 1: Config */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          border: '1px solid var(--line)',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.75rem' }}>
          Datos de la jornada
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {/* Fecha */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={step === 'visitas'}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
                background: step === 'visitas' ? 'var(--surface-2)' : '#fff',
              }}
            />
          </div>

          {/* Chofer */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Chofer *
            </label>
            <select
              value={choferId}
              onChange={(e) => setChoferId(e.target.value)}
              disabled={step === 'visitas'}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
                background: step === 'visitas' ? 'var(--surface-2)' : '#fff',
              }}
            >
              <option value="">Seleccionar...</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Camión */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Camión
            </label>
            <select
              value={camionId}
              onChange={(e) => setCamionId(e.target.value)}
              disabled={step === 'visitas'}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
                background: step === 'visitas' ? 'var(--surface-2)' : '#fff',
              }}
            >
              <option value="">Sin asignar</option>
              {camiones.map((c) => (
                <option key={c.id} value={c.id}>{c.patente}{c.descripcion ? ` — ${c.descripcion}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Notas
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {step === 'config' && (
          <button
            onClick={() => {
              if (!choferId) { alert('Seleccioná un chofer'); return }
              setStep('visitas')
            }}
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1.25rem',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Continuar →
          </button>
        )}

        {step === 'visitas' && (
          <button
            onClick={() => setStep('config')}
            style={{
              marginTop: '0.75rem',
              padding: '0.35rem 0.75rem',
              background: 'none',
              color: 'var(--muted)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            ← Modificar datos
          </button>
        )}
      </div>

      {/* Step 2: Visitas */}
      {step === 'visitas' && (
        <>
          {/* Available clients */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              border: '1px solid var(--line)',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Clientes con pallets disponibles
            </div>

            {clientesDisp.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '1rem 0' }}>
                No hay pallets planificables para tu empresa
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {clientesDisp.map((c) => {
                  const yaAgregado = visitas.some((v) => v.cliente_id === c.cliente_id)
                  // Oldest vencimiento
                  const minVenc = c.lineas
                    .map((l) => l.fecha_vencimiento)
                    .filter(Boolean)
                    .sort()[0]

                  return (
                    <div
                      key={c.cliente_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.5rem',
                        borderRadius: 6,
                        background: yaAgregado ? 'var(--surface-2)' : 'transparent',
                        opacity: yaAgregado ? 0.5 : 1,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink)' }}>
                          {c.nombre}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {c.localidad || ''}
                          {minVenc && ` · Vence: ${new Date(minVenc + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', minWidth: 50, textAlign: 'right' }}>
                        {c.total_planificable}
                      </div>

                      <button
                        onClick={() => agregarVisita(c)}
                        disabled={yaAgregado}
                        style={{
                          padding: '0.3rem 0.6rem',
                          background: yaAgregado ? 'var(--line)' : 'var(--green)',
                          color: yaAgregado ? 'var(--muted)' : '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: yaAgregado ? 'default' : 'pointer',
                        }}
                      >
                        {yaAgregado ? 'Agregado' : '+ Agregar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected visitas */}
          {visitas.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px solid var(--green)',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
                  Ruta planificada — {visitas.length} visita{visitas.length !== 1 ? 's' : ''} · {totalPallets} pallets
                </div>
              </div>

              {visitas.map((v, idx) => (
                <div
                  key={v.cliente_id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.6rem 0',
                    borderBottom: idx < visitas.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  {/* Order controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                    <button
                      onClick={() => moverVisita(idx, -1)}
                      disabled={idx === 0}
                      style={{
                        width: 22,
                        height: 18,
                        border: '1px solid var(--line)',
                        borderRadius: 3,
                        background: 'var(--surface)',
                        color: idx === 0 ? 'var(--line)' : 'var(--muted)',
                        fontSize: '0.6rem',
                        cursor: idx === 0 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ▲
                    </button>
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)' }}>
                      {v.orden}
                    </div>
                    <button
                      onClick={() => moverVisita(idx, 1)}
                      disabled={idx === visitas.length - 1}
                      style={{
                        width: 22,
                        height: 18,
                        border: '1px solid var(--line)',
                        borderRadius: 3,
                        background: 'var(--surface)',
                        color: idx === visitas.length - 1 ? 'var(--line)' : 'var(--muted)',
                        fontSize: '0.6rem',
                        cursor: idx === visitas.length - 1 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Client + quantity */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink)' }}>
                      {v.nombre}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                      {v.localidad || ''}
                    </div>

                    {/* Quantity input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Retirar:</label>
                      <input
                        type="number"
                        min={1}
                        max={v.max}
                        value={v.cantidad}
                        onChange={(e) => actualizarCantidad(v.cliente_id, parseInt(e.target.value) || 0)}
                        style={{
                          width: 70,
                          padding: '0.3rem 0.4rem',
                          borderRadius: 4,
                          border: '1px solid var(--line)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        / {v.max} disponibles
                      </span>
                    </div>

                    {/* FEFO breakdown */}
                    {v.imputaciones.length > 1 && (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                        FEFO: {v.imputaciones.map((imp) => (
                          <span key={imp.vale_linea_id} style={{ marginRight: '0.5rem' }}>
                            {imp.vale_numero} → {imp.cantidad_imputada}
                            {imp.fecha_vencimiento
                              ? ` (vence ${new Date(imp.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })})`
                              : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => quitarVisita(v.cliente_id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'none',
                      color: 'var(--red)',
                      border: 'none',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {visitas.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => guardar('definitiva')}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  background: 'var(--green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Guardando...' : 'Confirmar y asignar al chofer'}
              </button>
              <button
                onClick={() => guardar('borrador')}
                disabled={saving}
                style={{
                  padding: '0.6rem 1rem',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Guardar borrador
              </button>
              <button
                onClick={() => router.push('/transportista/hojas')}
                disabled={saving}
                style={{
                  padding: '0.6rem 1rem',
                  background: 'none',
                  color: 'var(--muted)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
