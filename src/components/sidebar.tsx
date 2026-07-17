'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAV_ITEMS = [
  { href: '/vales', label: 'Vales', icon: '📋' },
  { href: '/clientes', label: 'Clientes', icon: '🏭' },
  { href: '/transportistas', label: 'Transportistas', icon: '🚛' },
  { href: '/consulta', label: 'Consulta', icon: '🔍' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen flex flex-col py-6 px-4" style={{ background: 'var(--surface-2)' }}>
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>
          VaPal
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Trazabilidad de pallets</p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
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
  )
}
