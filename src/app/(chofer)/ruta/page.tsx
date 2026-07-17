import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function RutaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('users')
    .select('transportista_id')
    .eq('id', user!.id)
    .single()

  // Líneas de vales con trabajo pendiente
  const { data: lineas } = await supabase
    .from('vale_lineas')
    .select(`
      id, cantidad_autorizada, cantidad_retirada, estado, orden_ruta,
      clientes ( id, nombre, direccion, localidad ),
      vales!inner ( id, numero, estado, transportista_id )
    `)
    .eq('vales.transportista_id', perfil!.transportista_id)
    .in('vales.estado', ['asignado', 'en_curso', 'parcial'])
    .neq('estado', 'completa')
    .order('orden_ruta', { ascending: true })

  // ¿Hay algún remito en curso? (visita abierta sin cerrar)
  let visitaActiva: any = null
  if (lineas && lineas.length > 0) {
    const lineaIds = lineas.map((l: any) => l.id)
    const { data: remitosEnCurso } = await supabase
      .from('remitos')
      .select('id, vale_linea_id, fichada_entrada_at')
      .in('vale_linea_id', lineaIds)
      .eq('estado', 'en_curso')
      .limit(1)
      .maybeSingle()
    visitaActiva = remitosEnCurso
  }

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-medium tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>Mi ruta</h2>
        <p className="text-sm capitalize" style={{ color: 'var(--muted)' }}>{hoy}</p>
      </div>

      {visitaActiva && (
        <div className="rounded-md p-3 mb-4 text-center text-xs font-semibold uppercase tracking-wider"
          style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D' }}>
          Tenés una visita en curso — completala antes de pasar al siguiente cliente.
        </div>
      )}

      {(!lineas || lineas.length === 0) && (
        <div className="rounded-md p-10 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
          No hay retiros asignados por ahora.
        </div>
      )}

      <div className="relative">
        {/* Línea vertical de ruta */}
        {lineas && lineas.length > 1 && (
          <div className="absolute left-[19px] top-[40px] bottom-[40px] w-[2px]"
            style={{ background: 'var(--line)' }} />
        )}

        <div className="flex flex-col gap-0">
          {lineas?.map((linea: any, i: number) => {
            const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
            const esActiva = visitaActiva?.vale_linea_id === linea.id
            const bloqueada = visitaActiva && !esActiva

            return (
              <div key={linea.id} className="relative flex gap-3 py-3">
                {/* Nodo de ruta */}
                <div className="relative z-10 shrink-0 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{
                      background: esActiva ? 'var(--brand)' : bloqueada ? 'var(--surface-2, #97A3AA)' : 'var(--ink)',
                      color: '#fff',
                      opacity: bloqueada ? 0.5 : 1,
                    }}>
                    {linea.orden_ruta ?? i + 1}
                  </div>
                </div>

                {/* Tarjeta */}
                {esActiva ? (
                  <Link href={`/ruta/${linea.id}`} className="flex-1 block rounded-md p-4 transition-transform active:scale-[.98]"
                    style={{ background: 'var(--surface)', border: '2px solid var(--brand)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--brand)' }}>
                          ● En curso
                        </div>
                        <div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {linea.clientes.direccion}{linea.clientes.localidad ? ` · ${linea.clientes.localidad}` : ''}
                        </div>
                        <div className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)' }}>{linea.vales.numero}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div>
                      </div>
                    </div>
                    <div className="mt-3 py-2.5 rounded text-center text-xs font-bold uppercase tracking-wider text-white"
                      style={{ background: 'var(--brand)' }}>
                      Continuar visita
                    </div>
                  </Link>
                ) : bloqueada ? (
                  <div className="flex-1 rounded-md p-4"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', opacity: 0.45 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {linea.clientes.direccion}{linea.clientes.localidad ? ` · ${linea.clientes.localidad}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--muted)' }}>{pendiente}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link href={`/ruta/${linea.id}`} className="flex-1 block rounded-md p-4 transition-transform active:scale-[.98]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {linea.clientes.direccion}{linea.clientes.localidad ? ` · ${linea.clientes.localidad}` : ''}
                        </div>
                        <div className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)' }}>{linea.vales.numero}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div>
                      </div>
                    </div>
                    {linea.estado === 'parcial' && (
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--amber, #C99031)' }}>
                        Retiro parcial — quedan {pendiente}
                      </div>
                    )}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
