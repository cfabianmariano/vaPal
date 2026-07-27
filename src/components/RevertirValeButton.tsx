'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  valeId: string
  valeNumero: string
  estadoActual: string
}

export default function RevertirValeButton({ valeId, valeNumero, estadoActual }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [confirmando, setConfirmando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function revertir() {
    setProcesando(true)
    setError('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id ?? null

      // 1. Update vale estado
      const { error: e1 } = await supabase
        .from('vales')
        .update({ estado: 'revertido' })
        .eq('id', valeId)
      if (e1) throw e1

      // 2. Update all pending/partial lines to completa (neutralize them)
      const { error: e2 } = await supabase
        .from('vale_lineas')
        .update({ estado: 'completa', cantidad_autorizada: 0 })
        .eq('vale_id', valeId)
        .in('estado', ['pendiente', 'parcial'])
      if (e2) throw e2

      // 3. Log event
      await supabase.from('vale_eventos').insert({
        vale_id: valeId,
        estado_anterior: estadoActual,
        estado_nuevo: 'revertido',
        user_id: userId,
        notas: 'Vale revertido — saldo liberado',
      })

      setConfirmando(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Error al revertir.')
      setProcesando(false)
    }
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>
        )}
        <button
          onClick={revertir}
          disabled={procesando}
          className="px-2 py-1 rounded text-xs font-semibold"
          style={{ background: 'var(--red)', color: '#fff', opacity: procesando ? 0.6 : 1 }}
        >
          {procesando ? '...' : 'Confirmar'}
        </button>
        <button
          onClick={() => { setConfirmando(false); setError('') }}
          className="px-2 py-1 rounded text-xs"
          style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="px-2 py-1 rounded text-xs font-medium"
      style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}
    >
      Revertir
    </button>
  )
}
