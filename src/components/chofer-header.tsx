'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SyncIndicator from './sync-indicator'

export default function ChoferHeader({ nombre }: { nombre: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState(nombre || 'Chofer')

  useEffect(() => {
    if (nombre && nombre !== 'Chofer' && nombre !== '') {
      // Recibimos nombre del server → guardar en cache
      try {
        localStorage.setItem('vapal_chofer_nombre', nombre)
      } catch { /* localStorage no disponible */ }
      setDisplayName(nombre)
    } else {
      // No hay nombre del server → leer del cache
      try {
        const cached = localStorage.getItem('vapal_chofer_nombre')
        if (cached) setDisplayName(cached)
      } catch { /* localStorage no disponible */ }
    }
  }, [nombre])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-10" style={{ background: 'var(--ink)' }}>
      <div className="flex items-center px-4 py-3 gap-3">
        {/* Logo — izquierda */}
        <img src="/VaPal__logo.png" alt="VaPal" style={{ height: '40px' }} />

        {/* Nombre chofer — centro, crece para ocupar espacio */}
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-white tracking-tight">{displayName}</div>
        </div>

        {/* Online + Salir — derecha */}
        <div className="flex flex-col items-end gap-1">
          <SyncIndicator />
          <button onClick={handleLogout} className="text-xs uppercase tracking-wider px-3 py-1.5 rounded"
            style={{ color: '#B8C4CE', border: '1px solid #4E5C68' }}>
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
