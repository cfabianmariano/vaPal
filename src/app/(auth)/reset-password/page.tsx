'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Supabase establece la sesión automáticamente desde los tokens del URL
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
  }, [supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La clave debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las claves no coinciden.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setError('No se pudo actualizar la clave. El link puede haber expirado.')
      return
    }

    setListo(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: '#B4BEC4' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/VaPal__logo.png"
            alt="VaPal"
            width={180}
            height={60}
            priority
          />
        </div>

        <div className="rounded-lg p-6 shadow-lg"
             style={{ background: '#CDD5DA', border: '1px solid #8C99A1' }}>

          {listo ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold"
                  style={{ color: '#1E2A38' }}>
                Clave actualizada
              </h2>
              <p className="text-sm" style={{ color: '#4E5C68' }}>
                Tu clave se cambió correctamente. Ya podés iniciar sesión.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="py-2 rounded text-sm font-semibold text-white"
                style={{ background: '#C55A2F' }}
              >
                Ir al login
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2"
                  style={{ color: '#1E2A38' }}>
                Nueva clave
              </h2>
              <p className="text-sm mb-4" style={{ color: '#4E5C68' }}>
                Elegí tu nueva clave para ingresar a VaPal.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Nueva clave"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="px-3 py-2 rounded text-sm border outline-none focus:ring-2"
                  style={{
                    background: '#fff',
                    borderColor: '#8C99A1',
                    color: '#1E2A38',
                  }}
                />
                <input
                  type="password"
                  placeholder="Repetir clave"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="px-3 py-2 rounded text-sm border outline-none focus:ring-2"
                  style={{
                    background: '#fff',
                    borderColor: '#8C99A1',
                    color: '#1E2A38',
                  }}
                />

                {error && (
                  <p className="text-sm" style={{ color: '#c53030' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 rounded text-sm font-semibold text-white transition-opacity"
                  style={{ background: '#C55A2F', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Guardando...' : 'Guardar clave'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
