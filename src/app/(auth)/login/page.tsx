'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState<'login' | 'reset'>('login')
  const [resetEnviado, setResetEnviado] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Detectar rol y redirigir
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'chofer') {
        router.push('/ruta')
      } else {
        router.push('/dashboard')
      }
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError('No se pudo enviar el email. Verificá la dirección.')
      return
    }

    setResetEnviado(true)
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

          {modo === 'login' ? (
            <>
              <h2 className="text-lg font-semibold mb-4"
                  style={{ color: '#1E2A38' }}>
                Iniciar sesión
              </h2>

              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="Contraseña"
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

                {error && (
                  <p className="text-sm" style={{ color: '#c53030' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 rounded text-sm font-semibold text-white transition-opacity"
                  style={{ background: '#C55A2F', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>

              <button
                onClick={() => { setModo('reset'); setError(''); setResetEnviado(false) }}
                className="mt-4 text-sm underline w-full text-center"
                style={{ color: '#4E5C68' }}
              >
                Olvidé mi clave
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2"
                  style={{ color: '#1E2A38' }}>
                Recuperar clave
              </h2>

              {resetEnviado ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm leading-relaxed" style={{ color: '#4E5C68' }}>
                    Si hay una cuenta con ese email, vas a recibir un link para crear una clave nueva. Revisá tu bandeja de entrada y spam.
                  </p>
                  <button
                    onClick={() => { setModo('login'); setResetEnviado(false); setError('') }}
                    className="py-2 rounded text-sm font-semibold text-white"
                    style={{ background: '#2E4A63' }}
                  >
                    Volver al login
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm mb-4" style={{ color: '#4E5C68' }}>
                    Ingresá tu email y te enviamos un link para crear una clave nueva.
                  </p>
                  <form onSubmit={handleReset} className="flex flex-col gap-3">
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      {loading ? 'Enviando...' : 'Enviar link'}
                    </button>
                  </form>

                  <button
                    onClick={() => { setModo('login'); setError('') }}
                    className="mt-4 text-sm underline w-full text-center"
                    style={{ color: '#4E5C68' }}
                  >
                    Volver al login
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#4E5C68' }}>
          VaPal · Trazabilidad de pallets
        </p>
      </div>
    </div>
  )
}
