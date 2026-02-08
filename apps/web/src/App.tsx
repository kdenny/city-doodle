import { Routes, Route, Link, useParams, Navigate } from 'react-router-dom'
import { MapCanvas } from './components/canvas'
import { EditorShell } from './components/shell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage, RegisterPage, WorldsPage } from './pages'
import { CityLoader } from './components/ui'
import { useWorld } from './api'

function WorldEditor() {
  const { worldId } = useParams<{ worldId: string }>()
  const { data: world, isLoading, error } = useWorld(worldId || '', {
    enabled: !!worldId,
    retry: false,
  })

  if (!worldId) {
    return <div className="p-8 text-red-600" data-testid="error">World ID not found</div>
  }

  if (isLoading) {
    return <CityLoader variant="page" />
  }

  if (error || !world) {
    return (
      <div className="p-8" data-testid="error">
        <h1 className="text-2xl font-bold text-red-600">World not found</h1>
        <p className="mt-2 text-gray-600">The world you're looking for doesn't exist or has been deleted.</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to My Worlds
        </Link>
      </div>
    )
  }

  return (
    <EditorShell worldId={worldId}>
      <MapCanvas className="absolute inset-0" showMockFeatures={false} seed={world.seed} geographicSetting={world.settings?.geographic_setting} worldId={worldId} />
    </EditorShell>
  )
}

function About() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-900">About</h1>
      <p className="mt-2 text-gray-600">
        City Doodle is a lightweight planning sim disguised as a map doodle.
      </p>
      <nav className="mt-4">
        <Link to="/" className="text-blue-600 hover:underline">
          Home
        </Link>
      </nav>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WorldsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/worlds" element={<Navigate to="/" replace />} />
      <Route
        path="/worlds/:worldId"
        element={
          <ProtectedRoute>
            <WorldEditor />
          </ProtectedRoute>
        }
      />
      <Route path="/about" element={<About />} />
    </Routes>
  )
}
