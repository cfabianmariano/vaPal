'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SyncIndicator from './sync-indicator'

const SIZES = [
  { label: 'A−', value: '15px' },
  { label: 'A',  value: '17px' },
  { label: 'A+', value: '19px' },
]

export default function ChoferHeader({ nombre }: { nombre: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState(nombre || 'Chofer')
  const [fontSize, setFontSize] = useState('17px')

  useEffect(() => {
    if (nombre && nombre !== 'Chofer' && nombre !== '') {
      try { localStorage.setItem('vapal_chofer_nombre', nombre) } catch {}
      setDisplayName(nombre)
    } else {
      try {
        const cached = localStorage.getItem('vapal_chofer_nombre')
        if (cached) setDisplayName(cached)
      } catch {}
    }
    // Leer tamaño guardado
    try {
      const saved = localStorage.getItem('vapal_font_size')
      if (saved) {
        setFontSize(saved)
        document.documentElement.style.fontSize = saved
      }
    } catch {}
  }, [nombre])

  function cambiarTamano(size: string) {
    setFontSize(size)
    document.documentElement.style.fontSize = size
    try { localStorage.setItem('vapal_font_size', size) } catch {}
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-10" style={{ background: '#1b3a4b' }}>
      <div className="flex items-center px-4 py-3 gap-3">
        {/* Logo */}
        <img src="/VaPal__logo.png" alt="VaPal" style={{ height: '36px' }} />

        {/* Nombre chofer */}
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-white tracking-tight">{displayName}</div>
        </div>

        {/* Online + Salir */}
        <div className="flex flex-col items-end gap-1">
          <SyncIndicator />
          <button onClick={handleLogout} className="text-xs uppercase tracking-wider px-3 py-1.5 rounded"
            style={{ color: '#8aa4b4', border: '1px solid #2c5065' }}>
            Salir
          </button>
        </div>
      </div>

      {/* Tamaño de letra */}
      <div className="flex items-center justify-center gap-1 px-4 pb-2">
        {SIZES.map((s) => (
          <button key={s.value} onClick={() => cambiarTamano(s.value)}
            className="px-3 py-1 rounded text-xs font-semibold transition-colors"
            style={{
              background: fontSize === s.value ? 'rgba(42,157,110,.3)' : 'transparent',
              color: fontSize === s.value ? '#fff' : '#5a7a8a',
              border: fontSize === s.value ? '1px solid rgba(42,157,110,.5)' : '1px solid transparent',
            }}>
            {s.label}
          </button>
        ))}
      </div>
    </header>
  )
}
