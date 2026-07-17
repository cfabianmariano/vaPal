'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    router.push('/vales')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-medium tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>VaPal</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>Trazabilidad de pallets</p>
        </div>
        <div className="rounded-md p-6" style={{ background: 'var(--surface)' }}>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--brand)' }}>{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded text-sm font-semibold uppercase tracking-wider text-white transition-opacity"
              style={{ background: 'var(--brand)', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
