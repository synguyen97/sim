'use client'

import { useEffect } from 'react'

export function HideNextJsToast() {
  useEffect(() => {
    const hideNextJsToast = () => {
      document.querySelectorAll('nextjs-portal, [id^="__next"] portal').forEach((portal) => {
        const shadow = (portal as any).shadowRoot
        if (shadow) {
          shadow.querySelectorAll('.nextjs-toast').forEach((toast: HTMLElement) => {
            toast.style.display = 'none'
          })
        }
      })
      document.querySelectorAll('.nextjs-toast').forEach((toast) => {
        (toast as HTMLElement).style.display = 'none'
      })
    }
    hideNextJsToast()
    const interval = setInterval(hideNextJsToast, 500)
    return () => clearInterval(interval)
  }, [])

  return null
}