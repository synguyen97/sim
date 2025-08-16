'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import NavWrapper from '@/app/(landing)/components/nav-wrapper'
import Footer from '@/app/(landing)/components/sections/footer'
import Hero from '@/app/(landing)/components/sections/hero'
import Integrations from '@/app/(landing)/components/sections/integrations'
import Testimonials from '@/app/(landing)/components/sections/testimonials'

export default function Landing() {
  const router = useRouter()

  const handleOpenTypeformLink = () => {
    window.open('https://form.typeform.com/to/jqCO12pF', '_blank')
  }

  useEffect(() => {
    router.push('/login')
  }, [router])


  return (
    <main className='relative min-h-screen bg-[#0C0C0C] font-geist-sans flex items-center justify-center'>
    </main>
  )
}
