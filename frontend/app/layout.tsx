import type { Metadata, Viewport } from 'next'
import { DM_Sans, Cormorant_Garamond, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/AuthContext'
import { WalletProvider } from '@/contexts/WalletContext'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cormorant',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-space-mono',
})

export const metadata: Metadata = {
  title: 'MediLedger Nigeria - Decentralized Health Data Ecosystem',
  description: "Nigeria's first decentralized health data ecosystem — secured by zero-knowledge proofs, governed by patients, and powered by Hedera blockchain.",
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0D2B1F',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable} ${spaceMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <WalletProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: '#0D2B1F', color: '#C8F5E0', border: '1px solid #2A5A40' },
                success: { iconTheme: { primary: '#4ADE80', secondary: '#0D2B1F' } },
                error: { iconTheme: { primary: '#F87171', secondary: '#0D2B1F' } },
              }}
            />
          </WalletProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
