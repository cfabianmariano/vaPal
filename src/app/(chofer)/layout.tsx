import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ChoferHeader from '@/components/chofer-header'

export default async function ChoferLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('users')
    .select('role, nombre')
    .eq('id', user.id)
    .single()

  // Solo choferes entran acá. Cualquier otro rol vuelve al dashboard.
  if (perfil?.role !== 'chofer') redirect('/vales')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <ChoferHeader nombre={perfil.nombre} />
      <main className="p-4 max-w-md mx-auto">{children}</main>
    </div>
  )
}
