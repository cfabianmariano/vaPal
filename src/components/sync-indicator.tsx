'use client'
import { useState, useEffect } from 'react'
import { useOnline } from '@/lib/use-online'
import { contarPendientes } from '@/lib/offline-store'
import { sincronizar } from '@/lib/offline-sync'

export default function SyncIndicator() {
  const online = useOnline()
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  useEffect(() => {
    contarPendientes().then(setPendientes)
    const interval = setInterval(() => contarPendientes().then(setPendientes), 3000)
    return () => clearInterval(interval)
  }, [])

  // Sincronizar automáticamente cuando vuelve la señal
  useEffect(() => {
    if (online && pendientes > 0) {
      hacerSync()
    }
  }, [online])

  async function hacerSync() {
    if (sincronizando || !online) return
    setSincronizando(true)
    setResultado(null)
    try {
      const { ok, errores } = await sincronizar()
      const nuevos = await contarPendientes()
      setPendientes(nuevos)
      if (errores > 0) {
        setResultado(`${ok} enviados, ${errores} con error`)
      } else if (ok > 0) {
        setResultado(`${ok} enviados ✓`)
      }
      setTimeout(() => setResultado(null), 4000)
    } catch {
      setResultado('Error al sincronizar')
      setTimeout(() => setResultado(null), 4000)
    }
    setSincronizando(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Indicador de conexión */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: online ? '#5D7040' : '#B3261E' }}
        />
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Pendientes + botón sync */}
      {pendientes > 0 && (
        <button
          onClick={hacerSync}
          disabled={sincronizando || !online}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
          style={{
            background: online ? 'var(--brand)' : 'var(--surface-2)',
            color: online ? '#fff' : 'var(--muted)',
            opacity: sincronizando ? 0.6 : 1,
          }}
        >
          {sincronizando ? '⟳ Enviando…' : `${pendientes} pendiente${pendientes > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Resultado */}
      {resultado && (
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
          {resultado}
        </span>
      )}
    </div>
  )
}
