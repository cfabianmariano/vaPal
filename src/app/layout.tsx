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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
