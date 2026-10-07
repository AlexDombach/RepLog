import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useApp } from './state/AppContext'
import Home from './pages/Home'
import Workout from './pages/Workout'
import ActiveSession from './pages/ActiveSession'
import History from './pages/History'
import SessionDetail from './pages/SessionDetail'
import Library from './pages/Library'
import Settings from './pages/Settings'

export default function App() {
  const { ready } = useApp()

  if (!ready) {
    return (
      <div className="h-full grid place-items-center bg-ink">
        <div className="flex items-baseline gap-1.5 animate-pulse">
          <span className="text-3xl font-black tracking-tight">Rep</span>
          <span className="text-3xl font-black tracking-tight text-accent">Log</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="workout" element={<Workout />} />
        <Route path="workout/active/:sessionId" element={<ActiveSession />} />
        <Route path="history" element={<History />} />
        <Route path="history/:sessionId" element={<SessionDetail />} />
        <Route path="library" element={<Library />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
