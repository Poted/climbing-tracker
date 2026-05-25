'use client'

import { useEffect } from 'react'

export default function PWAInstaller() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    let deferredPrompt: any = null

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
    }

    const handleAppInstalled = () => {
      console.log('PWA was installed')
      deferredPrompt = null
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration)
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error)
      })

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return null
}
