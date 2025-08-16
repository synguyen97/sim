'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DiscordIcon, GithubIcon, xIcon as XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import useIsMobile from '@/app/(landing)/components/hooks/use-is-mobile'
import { usePrefetchOnHover } from '@/app/(landing)/utils/prefetch'

function Footer() {
  const router = useRouter()
  const { isMobile, mounted } = useIsMobile()
  const { data: session, isPending } = useSession()
  const isAuthenticated = !isPending && !!session?.user

  const handleContributorsHover = usePrefetchOnHover()

  const handleNavigate = () => {
    if (typeof window !== 'undefined') {
      // Check if user has an active session
      if (isAuthenticated) {
        router.push('/workspace')
      } else {
        // Check if user has logged in before
        const hasLoggedInBefore =
          localStorage.getItem('has_logged_in_before') === 'true' ||
          document.cookie.includes('has_logged_in_before=true')

        if (hasLoggedInBefore) {
          // User has logged in before but doesn't have an active session
          router.push('/login')
        } else {
          // User has never logged in before
          router.push('/signup')
        }
      }
    }
  }

  if (!mounted) {
    return <section className='flex w-full p-4 md:p-9' />
  }

  // If on mobile, render without animations
  if (isMobile) {
    return (
      <section className='flex w-full p-4 md:p-9'>
        <div className='flex w-full flex-col rounded-3xl bg-[#2B2334] p-6 sm:p-10 md:p-16'>
          <div className='flex h-full w-full flex-col justify-between md:flex-row'>
            {/* Left side content */}
            <div className='flex flex-col justify-between'>
              <p className='max-w-lg font-light text-5xl text-[#B5A1D4] leading-[1.1] md:text-6xl'>
                Ready to build AI faster and easier?
              </p>
              <div className='mt-4 pt-4 md:mt-auto md:pt-8'>
                <Button
                  className='w-fit bg-[#B5A1D4] text-[#1C1C1C] transition-colors duration-500 hover:bg-[#bdaecb]'
                  size={'lg'}
                  variant={'secondary'}
                  onClick={handleNavigate}
                >
                  Get Started
                </Button>
              </div>
            </div>

            {/* Right side content */}
            <div className='relative mt-8 flex w-full flex-col gap-6 md:mt-0 md:w-auto md:flex-row md:items-end md:justify-end md:gap-16'>
              {/* Links section - flex row on mobile, part of flex row in md */}
              <div className='flex w-full flex-row justify-between gap-4 md:w-auto md:justify-start md:gap-16'>
                <div className='flex flex-col gap-2'>
                  <Link
                    href={'/contributors'}
                    className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                    onMouseEnter={handleContributorsHover}
                  >
                    Contributors
                  </Link>
                </div>
                <div className='flex flex-col gap-2'>
                  <Link
                    href={'/terms'}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                  >
                    Terms and Conditions
                  </Link>
                  <Link
                    href={'/privacy'}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <motion.section
      className='flex w-full p-4 md:p-9'
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: 0.05, ease: 'easeOut' }}
    >
      <motion.div
        className='flex w-full flex-col rounded-3xl bg-[#2B2334] p-6 sm:p-10 md:p-16'
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
      >
        <motion.div
          className='flex h-full w-full flex-col justify-between md:flex-row'
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        >
          {/* Left side content */}
          <div className='flex flex-col justify-between'>
            <motion.p
              className='max-w-lg font-light text-5xl text-[#B5A1D4] leading-[1.1] md:text-6xl'
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
            >
              Ready to build AI faster and easier?
            </motion.p>
            <motion.div
              className='mt-4 pt-4 md:mt-auto md:pt-8'
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
            >
              <Button
                className='w-fit bg-[#B5A1D4] text-[#1C1C1C] transition-colors duration-500 hover:bg-[#bdaecb]'
                size={'lg'}
                variant={'secondary'}
                onClick={handleNavigate}
              >
                Get Started
              </Button>
            </motion.div>
          </div>

          {/* Right side content */}
          <motion.div
            className='relative mt-8 flex w-full flex-col gap-6 md:mt-0 md:w-auto md:flex-row md:items-end md:justify-end md:gap-16'
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.28, ease: 'easeOut' }}
          >

            {/* Links section - flex row on mobile, part of flex row in md */}
            <div className='flex w-full flex-row justify-between gap-4 md:w-auto md:justify-start md:gap-16'>
              <motion.div
                className='flex flex-col gap-2'
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: 0.32, ease: 'easeOut' }}
              >
                <Link
                  href={'/contributors'}
                  className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                  onMouseEnter={handleContributorsHover}
                >
                  Contributors
                </Link>
              </motion.div>
              <motion.div
                className='flex flex-col gap-2'
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: 0.36, ease: 'easeOut' }}
              >
                <Link
                  href={'/terms'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                >
                  Terms and Conditions
                </Link>
                <Link
                  href={'/privacy'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-light text-[#9E91AA] text-xl transition-all duration-500 hover:text-[#bdaecb] md:text-2xl'
                >
                  Privacy Policy
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

export default Footer
