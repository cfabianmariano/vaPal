'use client'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function ChoferHeader({ nombre }: { nombre: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
      style={{ background: 'var(--ink)' }}>
      <div>
        <div className="text-lg font-medium tracking-tight text-white" style={{ fontFamily: "'Fraunces', serif" }}>VaPal</div>
        <div className="text-xs" style={{ color: 'var(--steel-soft, #B8C4CE)' }}>{nombre}</div>
      </div>
      <button onClick={handleLogout} className="text-xs uppercase tracking-wider px-3 py-2 rounded"
        style={{ color: '#B8C4CE', border: '1px solid #4E5C68' }}>
        Salir
      </button>
    </header>
  )
}
