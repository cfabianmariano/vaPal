import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VaPal — Trazabilidad de pallets',
  description: 'Sistema de trazabilidad digital para logística inversa de pallets',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1E2A38" />
      </head>
      <body>{children}</body>
    </html>
  )
}
