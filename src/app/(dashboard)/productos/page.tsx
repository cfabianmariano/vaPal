'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Producto { id: string; codigo_producto: string; descripcion: string; pallets_por_unidad: number }

export default function ProductosPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [palletsPorUnidad, setPalletsPorUnidad] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: profile } = await supabase.from('users').select('organization_id').eq('id', userData.user.id).single()
    if (!profile) return
    const { data } = await supabase.from('productos_retornables').select('*').eq('organization_id', profile.organization_id).order('codigo_producto')
    setProductos(data || [])
    setCargando(false)
  }

  async function agregar() {
    if (!codigo.trim()) { setError('Ingresá un código de producto.'); return }
    setError(null); setGuardando(true)
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('organization_id').eq('id', userData.user!.id).single()
    const { error: err } = await supabase.from('productos_retornables').insert({ organization_id: profile!.organization_id, codigo_producto: codigo.trim(), descripcion: descripcion.trim(), pallets_por_unidad: palletsPorUnidad })
    if (err) { setError(err.message); setGuardando(false); return }
    setCodigo(''); setDescripcion(''); setPalletsPorUnidad(1); setGuardando(false); cargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este producto retornable?')) return
    await supabase.from('productos_retornables').delete().eq('id', id)
    cargar()
  }

  if (cargando) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Cargando…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--ink)' }}>Productos retornables</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Códigos de producto del ERP que generan deuda de pallets al despachar.</p>

      <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)', letterSpacing: '.1em' }}>Agregar producto</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Código ERP</label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: PAL-001" className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} /></div>
          <div className="sm:col-span-2"><label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Descripción</label>
            <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Pallet estándar 1200x1000" className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} /></div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Pallets/unidad</label>
            <input type="number" value={palletsPorUnidad} onChange={(e) => setPalletsPorUnidad(parseInt(e.target.value) || 1)} min={1} className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} /></div>
        </div>
        {error && <p className="text-sm mt-2 font-semibold" style={{ color: '#b04040' }}>{error}</p>}
        <button onClick={agregar} disabled={guardando} className="mt-3 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white" style={{ background: 'var(--green)', opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : 'Agregar'}
        </button>
      </div>

      {productos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay productos retornables configurados. Agregá al menos uno antes de importar despachos.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--surface)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Código</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Descripción</th>
                <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pallets/u</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="py-3 px-4 text-xs font-medium" style={{ color: 'var(--ink)' }}>{p.codigo_producto}</td>
                  <td className="py-3 px-4" style={{ color: 'var(--ink)' }}>{p.descripcion || '—'}</td>
                  <td className="py-3 px-4 text-center" style={{ color: 'var(--ink)' }}>{p.pallets_por_unidad}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => eliminar(p.id)} className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#b04040' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
