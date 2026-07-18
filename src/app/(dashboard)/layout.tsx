import Sidebar from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
