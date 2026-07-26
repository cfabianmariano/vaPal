import Sidebar from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#1b3a4b' }}>
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6 rounded-l-lg" style={{ background: '#e4ecf0' }}>
        {children}
      </main>
    </div>
  )
}
