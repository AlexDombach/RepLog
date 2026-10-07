import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { cx, Sheet } from './ui'
import {
  DumbbellIcon,
  HistoryIcon,
  HomeIcon,
  LibraryIcon,
  SettingsIcon,
  CheckIcon,
  ChevronDown,
} from './Icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon, end: false },
  { to: '/history', label: 'History', Icon: HistoryIcon, end: false },
  { to: '/library', label: 'Library', Icon: LibraryIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
]

/** First letter(s) of a profile name for the switcher avatar. */
function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

export default function AppShell() {
  const { profiles, profile, setActiveProfile } = useApp()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const { pathname } = useLocation()

  // The active-session screen is immersive: no bottom tabs competing for thumbs.
  const immersive = pathname.startsWith('/workout/active')

  return (
    <div className="flex flex-col h-full bg-ink">
      {/* ---------------- Header ---------------- */}
      <header className="shrink-0 pt-safe px-safe bg-ink/85 backdrop-blur-xl border-b border-line/60 z-20">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight">Rep</span>
            <span className="text-xl font-black tracking-tight text-accent">Log</span>
          </div>

          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-full bg-surface border border-line active:bg-surface-2"
          >
            <span className="h-7 w-7 rounded-full bg-accent text-accent-ink grid place-items-center text-xs font-black">
              {initials(profile?.name ?? '')}
            </span>
            <span className="text-sm font-semibold max-w-24 truncate">
              {profile?.name}
            </span>
            <ChevronDown size={16} className="text-muted" />
          </button>
        </div>
      </header>

      {/* ---------------- Page ---------------- */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-safe">
        <Outlet />
        {/* Spacer so content clears the fixed tab bar. */}
        <div className={immersive ? 'h-4' : 'h-24'} />
      </main>

      {/* ---------------- Bottom tabs ---------------- */}
      {!immersive && (
        <nav className="shrink-0 bg-ink/90 backdrop-blur-xl border-t border-line px-safe pb-safe z-20">
          <div className="flex">
            {TABS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 transition-colors',
                    isActive ? 'text-accent' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} className={isActive ? 'scale-105' : ''} />
                    <span className="text-[10px] font-semibold tracking-wide">
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* ---------------- Profile switcher ---------------- */}
      <Sheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Switch profile"
      >
        <div className="space-y-2">
          {profiles.map((p) => {
            const active = p.id === profile?.id
            return (
              <button
                key={p.id}
                onClick={async () => {
                  await setActiveProfile(p.id)
                  setSwitcherOpen(false)
                }}
                className={cx(
                  'w-full flex items-center gap-3 p-3 rounded-2xl border text-left',
                  active
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface-2 border-line active:bg-line',
                )}
              >
                <span className="h-11 w-11 rounded-full bg-accent text-accent-ink grid place-items-center font-black">
                  {initials(p.name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{p.name}</span>
                  <span className="block text-xs text-muted">{p.xp} XP</span>
                </span>
                {active && <CheckIcon size={20} className="text-accent" />}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted mt-4 leading-relaxed">
          Each profile keeps its own history, streak, XP and PRs. The exercise
          library and gym equipment are shared. Rename profiles in Settings.
        </p>
      </Sheet>
    </div>
  )
}
