'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const navItems = [
  {
    href: '/transportista',
    label: 'Vales asignados',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="14" height="12" rx="2" />
        <line x1="5" y1="7" x2="13" y2="7" />
        <line x1="5" y1="10" x2="10" y2="10" />
      </svg>
    ),
  },
  {
    href: '/transportista/hojas',
    label: 'Hojas de ruta',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4h2v10H3z" />
        <circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="9" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="14" r="1.5" fill="currentColor" stroke="none" />
        <line x1="7" y1="4" x2="15" y2="4" />
        <line x1="7" y1="9" x2="15" y2="9" />
        <line x1="7" y1="14" x2="13" y2="14" />
      </svg>
    ),
  },
  {
    href: '/transportista/clientes',
    label: 'Por cliente',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="6" r="3" />
        <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
]

export default function TransportistaSidebar({ empresaNombre }: { empresaNombre: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Font size
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vapal_font_size')
      if (saved) document.documentElement.style.fontSize = saved
    } catch { /* ignore */ }
  }, [])

  const setFontSize = (size: string) => {
    document.documentElement.style.fontSize = size
    try { localStorage.setItem('vapal_font_size', size) } catch { /* ignore */ }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/transportista') return pathname === '/transportista'
    return pathname.startsWith(href)
  }

  const sidebar = (
    <aside
      className="flex flex-col justify-between"
      style={{
        width: 240,
        minHeight: '100vh',
        background: 'var(--ink)',
        color: '#e0eaf0',
        padding: '1.25rem 0',
      }}
    >
      <div>
        {/* Logo */}
        <div style={{ padding: '0 1.25rem', marginBottom: '0.5rem' }}>
          <Image src="/VaPal__logo.png" alt="VaPal" width={110} height={40} style={{ objectFit: 'contain' }} />
        </div>

        {/* Empresa */}
        <div
          style={{
            padding: '0.5rem 1.25rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--muted)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '0.75rem',
          }}
        >
          {empresaNombre}
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  router.push(item.href)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: active ? 600 : 400,
                  color: active ? '#fff' : '#b0c4d0',
                  background: active ? 'rgba(42,157,110,0.15)' : 'transparent',
                  borderLeft: active ? '3px solid var(--green)' : '3px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {item.icon}
                {item.label}
              </a>
            )
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div style={{ padding: '0 1.25rem' }}>
        {/* Font size */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.25rem',
            marginBottom: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {[
            { label: 'A−', size: '15px' },
            { label: 'A', size: '17px' },
            { label: 'A+', size: '19px' },
          ].map((f) => (
            <button
              key={f.size}
              onClick={() => setFontSize(f.size)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: f.label === 'A−' ? '0.75rem' : f.label === 'A+' ? '1rem' : '0.85rem',
                background: 'rgba(255,255,255,0.08)',
                color: '#b0c4d0',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.8rem',
            color: '#b0c4d0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 50,
          background: 'var(--ink)',
          color: '#e0eaf0',
          border: 'none',
          borderRadius: 6,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="19" y2="6" />
          <line x1="3" y1="11" x2="19" y2="11" />
          <line x1="3" y1="16" x2="19" y2="16" />
        </svg>
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
    </>
  )
}
