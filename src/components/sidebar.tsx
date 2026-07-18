'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/vales', label: 'Vales', icon: '📋' },
  { href: '/clientes', label: 'Clientes', icon: '🏭' },
  { href: '/transportistas', label: 'Transportistas', icon: '🚛' },
  { href: '/consulta', label: 'Consulta', icon: '🔍' },
    { href: '/productos', label: 'Productos ret.', icon: '📦' },
    { href: '/importar', label: 'Importar ERP', icon: '📄' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Hamburguesa — solo visible en mobile */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 flex items-center justify-center rounded-lg"
        style={{ background: 'var(--surface)', color: 'var(--ink)' }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay — solo mobile cuando está abierto */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col p-4 w-56 transition-transform duration-200 md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: 'var(--surface)' }}
      >
        {/* Botón cerrar — solo mobile */}
        <button
          onClick={() => setOpen(false)}
          className="md:hidden self-end mb-2 w-8 h-8 flex items-center justify-center rounded"
          style={{ color: 'var(--muted)' }}
        >
          ✕
        </button>

        <div className="mb-6 px-1">
          <img src="/VaPal__logo.png" alt="VaPal" style={{ width: '150px' }} />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors"
                style={{ background: isActive ? 'var(--bg)' : 'transparent', color: isActive ? 'var(--ink)' : 'var(--muted)' }}>
                <span>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>

        <button onClick={handleLogout} className="mt-auto px-3 py-2 text-sm text-left rounded transition-colors" style={{ color: 'var(--muted)' }}>
          Cerrar sesión
        </button>
      </aside>
    </>
  )
}
