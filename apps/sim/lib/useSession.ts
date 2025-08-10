'use client'

import { useState, useEffect } from 'react'
import { sessionBlocker } from './session-blocker'

export const useSession = () => {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const sessionData = await sessionBlocker.getSession()
        if (mounted) {
          setSession(sessionData)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Session load error:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      mounted = false
    }
  }, [])

  return { data: session, isLoading }
}