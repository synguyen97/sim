import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createLogger } from '@/lib/logs/console/logger'
import { syncThemeToNextThemes } from '@/lib/theme-sync'
import type { General, GeneralStore, UserSettings } from '@/stores/settings/general/types'

const logger = createLogger('GeneralStore')

const CACHE_TIMEOUT = 3600000 // 1 hour - settings rarely change
const MAX_ERROR_RETRIES = 2

export const useGeneralStore = create<GeneralStore>()(
  devtools(
    persist(
      (set, get) => {
        let lastLoadTime = 0
        let errorRetryCount = 0
        let hasLoadedFromDb = false // Track if we've loaded from DB in this session

        const store: General = {
          isAutoConnectEnabled: true,
          isAutoPanEnabled: true,
          isConsoleExpandedByDefault: true,
          isDebugModeEnabled: false,
          theme: 'system' as const, // Keep for compatibility but not used
          telemetryEnabled: true,
          isLoading: false,
          error: null,
          // Individual loading states
          isAutoConnectLoading: false,
          isAutoPanLoading: false,
          isConsoleExpandedByDefaultLoading: false,
          isThemeLoading: false, // Keep for compatibility but not used
          isTelemetryLoading: false,
        }

        // Optimistic update helper
        const updateSettingOptimistic = async <K extends keyof UserSettings>(
          key: K,
          value: UserSettings[K],
          loadingKey: keyof General,
          stateKey: keyof General
        ) => {
          // Prevent multiple simultaneous updates
          if ((get() as any)[loadingKey]) return

          const originalValue = (get() as any)[stateKey]

          // Optimistic update
          set({ [stateKey]: value, [loadingKey]: true } as any)

          try {
            await get().updateSetting(key, value)
            set({ [loadingKey]: false } as any)
          } catch (error) {
            // Rollback on error
            set({ [stateKey]: originalValue, [loadingKey]: false } as any)
            logger.error(`Failed to update ${String(key)}, rolled back:`, error)
          }
        }

        return {
          ...store,
          // Basic Actions with optimistic updates
          toggleAutoConnect: async () => {
            if (get().isAutoConnectLoading) return
            const newValue = !get().isAutoConnectEnabled
            await updateSettingOptimistic(
              'autoConnect',
              newValue,
              'isAutoConnectLoading',
              'isAutoConnectEnabled'
            )
          },

          toggleAutoPan: async () => {
            if (get().isAutoPanLoading) return
            const newValue = !get().isAutoPanEnabled
            await updateSettingOptimistic(
              'autoPan',
              newValue,
              'isAutoPanLoading',
              'isAutoPanEnabled'
            )
          },

          toggleConsoleExpandedByDefault: async () => {
            if (get().isConsoleExpandedByDefaultLoading) return
            const newValue = !get().isConsoleExpandedByDefault
            await updateSettingOptimistic(
              'consoleExpandedByDefault',
              newValue,
              'isConsoleExpandedByDefaultLoading',
              'isConsoleExpandedByDefault'
            )
          },

          toggleDebugMode: () => {
            set({ isDebugModeEnabled: !get().isDebugModeEnabled })
          },

          setTheme: async (theme) => {
            if (get().isThemeLoading) return

            const originalTheme = get().theme

            // Optimistic update
            set({ theme, isThemeLoading: true })

            // Update next-themes immediately for instant feedback
            syncThemeToNextThemes(theme)

            try {
              // Sync to DB for authenticated users
              await get().updateSetting('theme', theme)
              set({ isThemeLoading: false })
            } catch (error) {
              // Rollback on error
              set({ theme: originalTheme, isThemeLoading: false })
              syncThemeToNextThemes(originalTheme)
              logger.error('Failed to sync theme to database:', error)
              throw error
            }
          },

          setTelemetryEnabled: async (enabled) => {
            if (get().isTelemetryLoading) return
            await updateSettingOptimistic(
              'telemetryEnabled',
              enabled,
              'isTelemetryLoading',
              'telemetryEnabled'
            )
          },

          // API Actions
          loadSettings: async (force = false) => {
            // Skip if we've already loaded from DB and not forcing
            if (hasLoadedFromDb && !force) {
              logger.debug('Already loaded settings from DB, using cached data')
              return
            }

            // If we have persisted state and not forcing, check if we need to load
            const persistedState = localStorage.getItem('general-settings')
            if (persistedState && !force) {
              try {
                const parsed = JSON.parse(persistedState)
                // If we have valid theme data, skip DB load unless forced
                if (parsed.state?.theme) {
                  logger.debug('Using cached settings from localStorage')
                  hasLoadedFromDb = true // Mark as loaded to prevent future API calls
                  return
                }
              } catch (e) {
                // If parsing fails, continue to load from DB
              }
            }
            // Skip loading if on a subdomain or chat path
            if (
              typeof window !== 'undefined' &&
              (window.location.pathname.startsWith('/chat/') ||
                (window.location.hostname !== 'sim.ai' &&
                  window.location.hostname !== 'localhost' &&
                  window.location.hostname !== '127.0.0.1' &&
                  !window.location.hostname.startsWith('www.')))
            ) {
              logger.debug('Skipping settings load - on chat or subdomain page')
              return
            }

            // Skip loading if settings were recently loaded (within 5 seconds)
            const now = Date.now()
            if (!force && now - lastLoadTime < CACHE_TIMEOUT) {
              logger.debug('Skipping settings load - recently loaded')
              return
            }

            try {
              set({ isLoading: true, error: null })

              const response = await fetch('/api/users/me/settings')

              if (!response.ok) {
                throw new Error('Failed to fetch settings')
              }

              const { data } = await response.json()

              set({
                isAutoConnectEnabled: data.autoConnect,
                isAutoPanEnabled: data.autoPan ?? true,
                isConsoleExpandedByDefault: data.consoleExpandedByDefault ?? true,
                theme: data.theme || 'system',
                telemetryEnabled: data.telemetryEnabled,
                isLoading: false,
              })

              // Sync theme to next-themes if it's different
              if (data.theme && typeof window !== 'undefined') {
                const currentTheme = localStorage.getItem('sim-theme')
                if (currentTheme !== data.theme) {
                  syncThemeToNextThemes(data.theme)
                }
              }

              lastLoadTime = now
              errorRetryCount = 0
              hasLoadedFromDb = true
            } catch (error) {
              logger.error('Error loading settings:', error)
              set({
                error: error instanceof Error ? error.message : 'Unknown error',
                isLoading: false,
              })
            }
          },

          updateSetting: async (key, value) => {
            if (
              typeof window !== 'undefined' &&
              (window.location.pathname.startsWith('/chat/') ||
                (window.location.hostname !== 'sim.ai' &&
                  window.location.hostname !== 'localhost' &&
                  window.location.hostname !== '127.0.0.1' &&
                  !window.location.hostname.startsWith('www.')))
            ) {
              logger.debug(`Skipping setting update for ${key} on chat or subdomain page`)
              return
            }

            try {
              const response = await fetch('/api/users/me/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
              })

              if (!response.ok) {
                throw new Error(`Failed to update setting: ${key}`)
              }

              set({ error: null })
              lastLoadTime = Date.now()
              errorRetryCount = 0
            } catch (error) {
              logger.error(`Error updating setting ${key}:`, error)
              set({ error: error instanceof Error ? error.message : 'Unknown error' })

              // Don't auto-retry on individual setting updates to avoid conflicts
              throw error
            }
          },
        }
      },
      {
        name: 'general-settings',
      }
    ),
    { name: 'general-store' }
  )
)
