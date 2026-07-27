import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TransportistaSidebar from '@/components/transportista-sidebar'

export default async function TransportistaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('users')
    .select('role, transportista_id')
    .eq('id', user.id)
    .single()

  // Solo transportista_admin entra acá
  if (!perfil || perfil.role !== 'transportista_admin') redirect('/dashboard')
  if (!perfil.transportista_id) redirect('/dashboard')

  // Obtener nombre de la empresa transportista
  let empresaNombre = ''
  const { data: transp } = await supabase
    .from('transportistas')
    .select('nombre')
    .eq('id', perfil.transportista_id)
    .single()
  empresaNombre = transp?.nombre || ''

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <TransportistaSidebar empresaNombre={empresaNombre} />
      <main className="flex-1 p-6 md:p-8 pt-16 md:pt-8">{children}</main>
    </div>
  )
}
