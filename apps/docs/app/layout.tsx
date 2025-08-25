import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider'
import { Inter } from 'next/font/google'
import './global.css'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({
  subsets: ['latin'],
})

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' className={inter.className} suppressHydrationWarning>
      <body className='flex min-h-screen flex-col'>
        <RootProvider>
          {children}
          <Analytics />
        </RootProvider>
      </body>
    </html>
  )
}

export const metadata = {
  title: 'Code',
  description:
    'Build agents in seconds with a drag and drop workflow builder. Access comprehensive documentation to help you create efficient workflows and maximize your automation capabilities.',
  manifest: '/favicon/site.webmanifest',
  icons: {
    shortcut: '/favicon/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Code Docs',
  },
}
