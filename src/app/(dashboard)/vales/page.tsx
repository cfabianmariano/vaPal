import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import RevertirValeButton from '@/components/RevertirValeButton'

const ESTADO_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  sin_asignar: { label: 'Sin asignar', bg: 'var(--surface-2)', color: 'var(--muted)' },
  asignado:    { label: 'Asignado',    bg: 'var(--blue)',       color: '#fff' },
  en_curso:    { label: 'En curso',    bg: 'var(--green)',      color: '#fff' },
  parcial:     { label: 'Parcial',     bg: 'var(--amber)',      color: '#fff' },
  completo:    { label: 'Completo',    bg: 'var(--green-dark)', color: '#fff' },
  cerrado:     { label: 'Cerrado',     bg: 'var(--surface-2)', color: 'var(--muted)' },
  revertido:   { label: 'Revertido',   bg: 'var(--red)',        color: '#fff' },
}

// Un vale se puede revertir si no tiene retiros ejecutados
const ESTADOS_REVERTIBLES = ['sin_asignar', 'asignado']

export default async function ValesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vales')
    .select('id, numero, estado, fecha_creacion, fecha_vencimiento, notas, transportistas(nombre), vale_lineas(cantidad_autorizada, cantidad_retirada)')
    .order('fecha_creacion', { ascending: false })

  const vales = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--ink)' }}>Vales de retiro</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Órdenes de retiro activas y completadas</p>
        </div>
        <Link href="/vales/nuevo" className="px-4 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--green)', color: '#fff' }}>
          + Nuevo vale
        </Link>
      </div>

      {error && (
        <div className="rounded-md p-4 text-sm mb-4" style={{ background: 'rgba(176,64,64,.12)', color: 'var(--red)' }}>
          Error al cargar vales: {error.message}
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Número</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Transportista</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Autoriz.</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Retirado</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Estado</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Vence</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}></th>
            </tr>
          </thead>
          <tbody>
            {vales.map((v: any) => {
              const est = ESTADO_LABELS[v.estado] ?? ESTADO_LABELS.sin_asignar
              const autorizado = (v.vale_lineas ?? []).reduce((s: number, l: any) => s + l.cantidad_autorizada, 0)
              const retirado = (v.vale_lineas ?? []).reduce((s: number, l: any) => s + l.cantidad_retirada, 0)
              const puedeRevertir = ESTADOS_REVERTIBLES.includes(v.estado) && retirado === 0

              // Check if vale is expired or near expiry
              let venceStyle: React.CSSProperties = { color: 'var(--muted)' }
              if (v.fecha_vencimiento && v.estado !== 'cerrado' && v.estado !== 'completo' && v.estado !== 'revertido') {
                const hoy = new Date()
                hoy.setHours(0, 0, 0, 0)
                const vence = new Date(v.fecha_vencimiento + 'T00:00:00')
                const diffDias = Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
                if (diffDias < 0) {
                  venceStyle = { color: 'var(--red)', fontWeight: 600 }
                } else if (diffDias <= 3) {
                  venceStyle = { color: 'var(--amber)', fontWeight: 600 }
                }
              }

              return (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="px-4 py-3 text-xs font-medium">{v.numero}</td>
                  <td className="px-4 py-3">{v.transportistas?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>{autorizado}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>{retirado}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={venceStyle}>
                    {v.fecha_vencimiento
                      ? new Date(v.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {puedeRevertir && (
                      <RevertirValeButton
                        valeId={v.id}
                        valeNumero={v.numero}
                        estadoActual={v.estado}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
            {vales.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>No hay vales creados todavía. Creá el primero con el botón "Nuevo vale".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
