import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Super Mario Bros Clone',
  description: 'A Next.js canvas clone of Super Mario Bros 1-1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
