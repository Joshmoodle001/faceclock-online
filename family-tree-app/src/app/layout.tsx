import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Family Tree Clock',
  description: 'Family tree clock-in application for parent-child drop-off attendance tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
