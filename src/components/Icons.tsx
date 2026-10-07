/** Minimal inline icon set — no icon dependency, all stroke-based and themeable. */
type P = { className?: string; size?: number }

function Svg({
  className = '',
  size = 24,
  children,
}: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </Svg>
)

export const DumbbellIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
  </Svg>
)

export const HistoryIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 3v3M16 3v3" />
  </Svg>
)

export const LibraryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 5h6v14H4zM14 5h6v14h-6zM4 9.5h6M14 9.5h6" />
  </Svg>
)

export const SettingsIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </Svg>
)

export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12.5l5.5 5.5L20 7" />
  </Svg>
)

export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M5 9l7 7 7-7" />
  </Svg>
)

export const XIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const FlameIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5s5.5 4.3 5.5 9.2a5.5 5.5 0 1 1-11 0c0-1.9 1-3.4 1.9-4.4.2 1.4 1 2.3 1.9 2.3 1.3 0 1.8-1.6 1.7-3.1-.1-1.6 0-3 0-4z" />
  </Svg>
)

export const TrophyIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5M9 20h6M12 14v6" />
  </Svg>
)

export const BoltIcon = (p: P) => (
  <Svg {...p}>
    <path d="M13 2.5 4.5 13.5H11l-1 8L19 10.5h-6.5l.5-8z" />
  </Svg>
)

export const TimerIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 2M9.5 2h5" />
  </Svg>
)

export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 21h9l1-14.5M10.5 10.5v6.5M13.5 10.5v6.5" />
  </Svg>
)

export const SwapIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Svg>
)

export const GripIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" strokeWidth={2.6} />
  </Svg>
)

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
)

export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16" />
  </Svg>
)

export const UploadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M4 19.5h16" />
  </Svg>
)

export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5 19 12 7 19.5V4.5z" fill="currentColor" />
  </Svg>
)

export const PauseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 5v14M15 5v14" strokeWidth={2.6} />
  </Svg>
)

export const UserIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
)
