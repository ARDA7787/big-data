import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from './providers'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export const metadata: Metadata = {
  title: 'Scholarly Knowledge Graph',
  description: 'Explore research papers and citation networks at scale',
  keywords: ['research', 'papers', 'citations', 'knowledge graph', 'big data'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-neutral-50">
        <Providers>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main content */}
            <div className="flex-1 flex flex-col ml-64">
              <Header />
              <main className="flex-1 p-8">
                <div className="max-w-7xl mx-auto page-enter">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}

