export default function ClientesPage() {
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Clientes</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Clientes con deuda de pallets</p>
      <div className="rounded-md p-12 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
        La lista de clientes se construye en la Fase 1.
      </div>
    </div>
  )
}
