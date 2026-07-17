'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { CuentaCorriente, Transportista } from '@/types/database'

export default function NuevoValePage() {
  const router = useRouter()
  const supabase = createClient()

  const [clientes, setClientes] = useState<CuentaCorriente[]>([])
  const [transportistas, setTransportistas] = useState<Transportista[]>([])
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [transportistaId, setTransportistaId] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const [cc, tt] = await Promise.all([
        supabase.from('cuenta_corriente').select('*').gt('saldo_deuda', 0).order('saldo_deuda', { ascending: false }),
        supabase.from('transportistas').select('*').eq('activo', true).order('nombre'),
      ])
      setClientes((cc.data ?? []) as CuentaCorriente[])
      setTransportistas((tt.data ?? []) as Transportista[])
    }
    cargar()
  }, [])

  function setCantidad(clienteId: string, valor: number, max: number) {
    const v = Math.max(0, Math.min(valor, max))
    setCantidades((prev) => ({ ...prev, [clienteId]: v }))
  }

  const lineas = Object.entries(cantidades).filter(([, cant]) => cant > 0)
  const totalPallets = lineas.reduce((s, [, c]) => s + c, 0)

  async function crearVale() {
    setError('')
    if (lineas.length === 0) { setError('Indicá al menos un cliente con cantidad a retirar.'); return }
    setGuardando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data: perfil } = await supabase.from('users').select('id, organization_id').eq('id', userData.user?.id).single()
      if (!perfil) throw new Error('No se encontró el perfil del usuario.')

      // Número de vale: VAL-AÑO-secuencia
      const anio = new Date().getFullYear()
      const { count } = await supabase.from('vales').select('id', { count: 'exact', head: true })
      const numero = `VAL-${anio}-${String((count ?? 0) + 1).padStart(4, '0')}`

      const estado = transportistaId ? 'asignado' : 'sin_asignar'

      const { data: vale, error: e1 } = await supabase.from('vales').insert({
        numero,
        organization_id: perfil.organization_id,
        transportista_id: transportistaId || null,
        estado,
        created_by: perfil.id,
        notas: notas || null,
      }).select().single()
      if (e1) throw e1

      const { error: e2 } = await supabase.from('vale_lineas').insert(
        lineas.map(([clienteId, cant], i) => ({
          vale_id: vale.id,
          cliente_id: clienteId,
          cantidad_autorizada: cant,
          cantidad_retirada: 0,
          estado: 'pendiente',
          orden_ruta: i + 1,
        }))
      )
      if (e2) throw e2

      const { error: e3 } = await supabase.from('vale_eventos').insert({
        vale_id: vale.id,
        estado_anterior: null,
        estado_nuevo: estado,
        user_id: perfil.id,
        notas: 'Vale creado',
      })
      if (e3) throw e3

      router.push('/vales')
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el vale.')
      setGuardando(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-medium tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Nuevo vale de retiro</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Seleccioná clientes con deuda, indicá cantidades y asigná un transportista</p>

      {error && (
        <div className="rounded-md p-4 text-sm mb-4" style={{ background: 'var(--brand-soft)', color: 'var(--ink)' }}>{error}</div>
      )}

      <div className="rounded-md overflow-hidden mb-6" style={{ background: 'var(--surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Cliente</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Deuda</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>A retirar</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.cliente_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="px-4 py-3 font-medium">{c.cliente_nombre}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--brand)' }}>{c.saldo_deuda}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number" min={0} max={c.saldo_deuda}
                    value={cantidades[c.cliente_id] ?? ''}
                    onChange={(e) => setCantidad(c.cliente_id, Number(e.target.value), c.saldo_deuda)}
                    placeholder="0"
                    className="w-24 px-2 py-1.5 rounded text-right text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>No hay clientes con deuda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md p-5 mb-6" style={{ background: 'var(--surface)' }}>
        <label className="block text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--muted)' }}>Transportista</label>
        <select
          value={transportistaId}
          onChange={(e) => setTransportistaId(e.target.value)}
          className="w-full px-3 py-2.5 rounded text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          <option value="">Sin asignar (asignar después)</option>
          {transportistas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>

        <label className="block text-xs uppercase tracking-wider font-semibold mb-2 mt-4" style={{ color: 'var(--muted)' }}>Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 rounded text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {lineas.length} cliente{lineas.length !== 1 ? 's' : ''} · <b style={{ color: 'var(--ink)' }}>{totalPallets} pallets</b>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/vales')} className="px-4 py-2.5 rounded text-sm font-medium" style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}>
            Cancelar
          </button>
          <button onClick={crearVale} disabled={guardando} className="px-5 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--brand)', color: '#fff', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Creando…' : 'Crear vale'}
          </button>
        </div>
      </div>
    </div>
  )
}