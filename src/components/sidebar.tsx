'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '▣' },
  { href: '/vales', label: 'Vales', icon: '▤' },
  { href: '/clientes', label: 'Clientes', icon: '▥' },
  { href: '/transportistas', label: 'Transportistas', icon: '▦' },
  { href: '/consulta', label: 'Consulta', icon: '◎' },
  { href: '/productos', label: 'Productos ret.', icon: '◈' },
  { href: '/importar', label: 'Importar ERP', icon: '◇' },
]

const S = {
  bg: '#1b3a4b',
  active: 'rgba(42,157,110,.15)',
  activeBorder: '#2a9d6e',
  activeText: '#fff',
  text: '#7a9aad',
  muted: '#5a7a8a',
}

const SIZES = [
  { label: 'A−', value: '15px' },
  { label: 'A',  value: '17px' },
  { label: 'A+', value: '19px' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fontSize, setFontSize] = useState('17px')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vapal_font_size')
      if (saved) {
        setFontSize(saved)
        document.documentElement.style.fontSize = saved
      }
    } catch {}
  }, [])

  function cambiarTamano(size: string) {
    setFontSize(size)
    document.documentElement.style.fontSize = size
    try { localStorage.setItem('vapal_font_size', size) } catch {}
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 flex items-center justify-center rounded-lg"
        style={{ background: '#e4ecf0', color: '#1b3a4b' }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col py-4 w-56 transition-transform duration-200 md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: S.bg }}>
        <button onClick={() => setOpen(false)} className="md:hidden self-end mb-2 mr-3 w-8 h-8 flex items-center justify-center rounded" style={{ color: S.text }}>✕</button>

        <div className="mb-6 px-4">
          <img src="/VaPal__logo.png" alt="VaPal" style={{ width: '140px' }} />
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ background: isActive ? S.active : 'transparent', color: isActive ? S.activeText : S.text, borderLeft: isActive ? `3px solid ${S.activeBorder}` : '3px solid transparent', borderRadius: 0 }}>
                <span style={{ fontSize: '11px', opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>

        {/* Tamaño de letra */}
        <div className="mx-4 mb-3 flex items-center gap-1">
          {SIZES.map((s) => (
            <button key={s.value} onClick={() => cambiarTamano(s.value)}
              className="flex-1 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background: fontSize === s.value ? 'rgba(42,157,110,.25)' : 'transparent',
                color: fontSize === s.value ? '#fff' : S.muted,
                border: fontSize === s.value ? '1px solid rgba(42,157,110,.4)' : '1px solid transparent',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <button onClick={handleLogout} className="mx-4 px-3 py-2 text-sm text-left transition-colors" style={{ color: S.muted }}>
          Cerrar sesión
        </button>
      </aside>
    </>
  )
}
