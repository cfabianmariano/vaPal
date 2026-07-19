'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Colores de la paleta VaPal
const C = {
  ink: '#1E2A38',
  muted: '#4E5C68',
  steel: '#2E4A63',
  brand: '#C55A2F',
  olive: '#5D7040',
  amber: '#C99031',
  bg: '#B4BEC4',
  surface: '#CDD5DA',
  line: '#8C99A1',
}

interface Resumen {
  retiros_mes: number
  pallets_mes: number
  cumplimiento_pct: number
  estadia_promedio_min: number
  pendientes: number
}

interface TransportistaKpi {
  transportista: string
  pallets_mes: number
  retiros_mes: number
}

interface EstadiaCliente {
  cliente: string
  estadia_promedio: number
  visitas: number
}

interface SaldoCliente {
  cliente_nombre: string
  saldo_deuda: number
  total_despachados: number
  total_retirados: number
}

interface Clasificacion {
  total_buenos: number
  total_recuperar: number
  total_scrap: number
  total_general: number
  pct_buenos: number
  pct_recuperar: number
  pct_scrap: number
}

interface RetiroSemana {
  semana: string
  pallets: number
  retiros: number
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [transportistas, setTransportistas] = useState<TransportistaKpi[]>([])
  const [estadias, setEstadias] = useState<EstadiaCliente[]>([])
  const [saldos, setSaldos] = useState<SaldoCliente[]>([])
  const [clasificacion, setClasificacion] = useState<Clasificacion | null>(null)
  const [semanas, setSemanas] = useState<RetiroSemana[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const [resR, transR, estR, salR, clasR, semR] = await Promise.all([
        supabase.from('kpi_resumen').select('*').single(),
        supabase.from('kpi_retiros_por_transportista').select('*'),
        supabase.from('kpi_estadias_por_cliente').select('*').limit(10),
        supabase.from('kpi_saldo_por_cliente').select('*').limit(10),
        supabase.from('kpi_clasificacion').select('*').single(),
        supabase.from('kpi_retiros_por_semana').select('*'),
      ])

      if (resR.data) setResumen(resR.data)
      if (transR.data) setTransportistas(transR.data)
      if (estR.data) setEstadias(estR.data)
      if (salR.data) setSaldos(salR.data)
      if (clasR.data) setClasificacion(clasR.data)
      if (semR.data) setSemanas(semR.data)

      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: C.muted }}>Cargando dashboard...</p>
      </div>
    )
  }

  const maxPalletsTrans = Math.max(...transportistas.map(t => t.pallets_mes), 1)
  const maxEstadia = Math.max(...estadias.map(e => e.estadia_promedio), 1)
  const maxPalletsSem = Math.max(...semanas.map(s => s.pallets), 1)

  const mesActual = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-wider font-mono" style={{ color: C.muted }}>
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: C.ink }}>
          {mesActual}
        </h1>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          valor={resumen?.retiros_mes ?? 0}
          label="Retiros del mes"
          color={C.steel}
          detalle={`${resumen?.pallets_mes ?? 0} pallets`}
        />
        <KpiCard
          valor={`${resumen?.cumplimiento_pct ?? 0}%`}
          label="Cumplimiento"
          color={C.olive}
        />
        <KpiCard
          valor={`${resumen?.estadia_promedio_min ?? 0}m`}
          label="Estadía promedio"
          color={C.ink}
        />
        <KpiCard
          valor={resumen?.pendientes ?? 0}
          label="Pendientes"
          color={C.brand}
        />
      </div>

      {/* Fila 2: Transportistas + Saldo pendiente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Retiros por transportista */}
        <Panel titulo="Retiros por transportista" subtitulo="Pallets del mes">
          {transportistas.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos aún</p>
          ) : (
            <div className="space-y-3">
              {transportistas.map((t) => (
                <div key={t.transportista}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: C.ink }}>{t.transportista}</span>
                    <span className="font-mono text-xs" style={{ color: C.muted }}>
                      {t.pallets_mes}
                    </span>
                  </div>
                  <div className="h-5 rounded-sm overflow-hidden" style={{ background: C.bg }}>
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${(t.pallets_mes / maxPalletsTrans) * 100}%`,
                        background: C.steel,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Saldo pendiente por cliente */}
        <Panel titulo="Saldo pendiente" subtitulo="Pallets por cliente">
          {saldos.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin deuda registrada</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: C.line }}>
                  <th className="text-left py-2 font-mono text-xs uppercase tracking-wider"
                      style={{ color: C.muted }}>Cliente</th>
                  <th className="text-right py-2 font-mono text-xs uppercase tracking-wider"
                      style={{ color: C.muted }}>Deuda</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.cliente_nombre} className="border-b" style={{ borderColor: `${C.line}40` }}>
                    <td className="py-2" style={{ color: C.ink }}>{s.cliente_nombre}</td>
                    <td className="py-2 text-right font-mono font-semibold" style={{ color: C.brand }}>
                      {s.saldo_deuda}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Fila 3: Estadías + Clasificación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estadía por cliente */}
        <Panel titulo="Estadía por cliente" subtitulo="Promedio en minutos">
          {estadias.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos de estadía</p>
          ) : (
            <div className="space-y-3">
              {estadias.map((e) => (
                <div key={e.cliente}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: C.ink }}>{e.cliente}</span>
                    <span className="font-mono text-xs" style={{ color: C.muted }}>
                      {e.estadia_promedio}m · {e.visitas} visitas
                    </span>
                  </div>
                  <div className="h-5 rounded-sm overflow-hidden" style={{ background: C.bg }}>
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(e.estadia_promedio / maxEstadia) * 100}%`,
                        background: e.estadia_promedio > 45 ? C.brand : C.amber,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Clasificación de pallets */}
        <Panel titulo="Clasificación acumulada" subtitulo="Distribución por estado">
          {!clasificacion || clasificacion.total_general === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos de clasificación</p>
          ) : (
            <div className="space-y-4">
              {/* Barra apilada */}
              <div className="h-8 rounded-sm overflow-hidden flex">
                <div
                  style={{ width: `${clasificacion.pct_buenos}%`, background: C.olive }}
                  title={`Buenos: ${clasificacion.pct_buenos}%`}
                />
                <div
                  style={{ width: `${clasificacion.pct_recuperar}%`, background: C.amber }}
                  title={`A recuperar: ${clasificacion.pct_recuperar}%`}
                />
                <div
                  style={{ width: `${clasificacion.pct_scrap}%`, background: C.brand }}
                  title={`Scrap: ${clasificacion.pct_scrap}%`}
                />
              </div>

              {/* Leyenda */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-mono text-lg font-semibold" style={{ color: C.olive }}>
                    {clasificacion.total_buenos}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Buenos ({clasificacion.pct_buenos}%)
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold" style={{ color: C.amber }}>
                    {clasificacion.total_recuperar}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    A recuperar ({clasificacion.pct_recuperar}%)
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold" style={{ color: C.brand }}>
                    {clasificacion.total_scrap}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Scrap ({clasificacion.pct_scrap}%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Fila 4: Tendencia semanal */}
      {semanas.length > 1 && (
        <Panel titulo="Tendencia semanal" subtitulo="Pallets retirados por semana">
          <div className="flex items-end gap-2" style={{ height: '120px' }}>
            {semanas.map((s) => (
              <div
                key={s.semana}
                className="flex-1 flex flex-col items-center justify-end"
              >
                <span className="font-mono text-xs mb-1" style={{ color: C.muted }}>
                  {s.pallets}
                </span>
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${(s.pallets / maxPalletsSem) * 100}%`,
                    minHeight: '4px',
                    background: C.steel,
                  }}
                />
                <span className="font-mono mt-1" style={{ fontSize: '0.6rem', color: C.muted }}>
                  {new Date(s.semana).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ---- Componentes auxiliares ----

function KpiCard({
  valor,
  label,
  color,
  detalle,
}: {
  valor: number | string
  label: string
  color: string
  detalle?: string
}) {
  return (
    <div className="rounded p-4" style={{ background: C.surface, border: `1px solid ${C.line}40` }}>
      <div className="font-serif text-3xl font-medium" style={{ color, letterSpacing: '-0.02em' }}>
        {typeof valor === 'number' ? valor.toLocaleString('es-AR') : valor}
      </div>
      <div className="font-mono text-xs uppercase tracking-wider mt-1" style={{ color: C.muted }}>
        {label}
      </div>
      {detalle && (
        <div className="text-xs mt-1" style={{ color: C.muted }}>{detalle}</div>
      )}
    </div>
  )
}

function Panel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded p-4" style={{ background: C.surface, border: `1px solid ${C.line}40` }}>
      <div className="mb-4">
        <h3 className="font-semibold text-sm" style={{ color: C.ink }}>{titulo}</h3>
        {subtitulo && (
          <p className="font-mono text-xs uppercase tracking-wider" style={{ color: C.muted }}>
            {subtitulo}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
