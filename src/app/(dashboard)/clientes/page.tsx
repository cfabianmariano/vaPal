import { createClient } from '@/lib/supabase-server'
import type { CuentaCorriente } from '@/types/database'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuenta_corriente')
    .select('*')
    .order('saldo_deuda', { ascending: false })

  const clientes = (data ?? []) as CuentaCorriente[]

  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Clientes</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Cuenta corriente de pallets por cliente</p>

      {error && (
        <div className="rounded-md p-4 text-sm mb-4" style={{ background: 'var(--brand-soft)', color: 'var(--ink)' }}>
          Error al cargar clientes: {error.message}
        </div>
      )}

      <div className="rounded-md overflow-hidden" style={{ background: 'var(--surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Cliente</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Despachados</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Retirados</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Deuda</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.cliente_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="px-4 py-3 font-medium">{c.cliente_nombre}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>{c.total_despachados}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>{c.total_retirados}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: c.saldo_deuda > 0 ? 'var(--brand)' : 'var(--olive)' }}>{c.saldo_deuda}</td>
              </tr>
            ))}
            {clientes.length === 0 && !error && (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>No hay clientes cargados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}