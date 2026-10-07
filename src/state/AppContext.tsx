import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, initDb } from '../db'
import type { AppSettings, Equipment, Exercise, Profile } from '../db/types'

interface AppState {
  ready: boolean
  settings: AppSettings | undefined
  profiles: Profile[]
  profile: Profile | undefined
  equipment: Equipment[]
  exercises: Exercise[]
  setActiveProfile: (id: string) => Promise<void>
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<void>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  /** Force a re-read after a bulk write (import / clear). */
  reload: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('DB init failed', err)
        setReady(true)
      })
  }, [nonce])

  const settings = useLiveQuery(() => db.settings.get('app'), [nonce])
  const profiles = useLiveQuery(() => db.profiles.toArray(), [nonce], [] as Profile[])
  const equipment = useLiveQuery(
    () => db.equipment.orderBy('order').toArray(),
    [nonce],
    [] as Equipment[],
  )
  const exercises = useLiveQuery(
    () => db.exercises.orderBy('name').toArray(),
    [nonce],
    [] as Exercise[],
  )

  const profile = useMemo(
    () => profiles.find((p) => p.id === settings?.activeProfileId) ?? profiles[0],
    [profiles, settings?.activeProfileId],
  )

  // Theme lives on <html> so the CSS tokens flip app-wide.
  useEffect(() => {
    const light = settings?.theme === 'light'
    document.documentElement.classList.toggle('theme-light', light)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', light ? '#f7f7f8' : '#0a0a0b')
  }, [settings?.theme])

  const setActiveProfile = useCallback(async (id: string) => {
    await db.settings.update('app', { activeProfileId: id })
  }, [])

  const updateProfile = useCallback(async (id: string, patch: Partial<Profile>) => {
    await db.profiles.update(id, patch)
  }, [])

  const setTheme = useCallback(async (theme: 'dark' | 'light') => {
    await db.settings.update('app', { theme })
  }, [])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const value: AppState = {
    ready: ready && !!settings && profiles.length > 0,
    settings,
    profiles,
    profile,
    equipment,
    exercises,
    setActiveProfile,
    updateProfile,
    setTheme,
    reload,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Convenience: the active profile, assumed present inside the app shell. */
export function useProfile(): Profile {
  const { profile } = useApp()
  if (!profile) throw new Error('No active profile')
  return profile
}
