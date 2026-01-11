import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Socket-Serve Chat',
  description: 'Real-time chat app using socket-serve',
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
