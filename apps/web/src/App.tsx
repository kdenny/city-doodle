import { Routes, Route, Link, useParams } from 'react-router-dom'
import { MapCanvas } from './components/canvas'
import { EditorShell } from './components/shell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage, RegisterPage, WorldsPage } from './pages'
import { useAuth } from './contexts'
import { useWorld } from './api'

function Home() {
  const { isAuthenticated, user, logout, isLoading } = useAuth()

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-900">City Doodle</h1>
      <p className="mt-2 text-gray-600">A lo-fi vector city builder</p>

      <nav className="mt-4 flex gap-4">
        <Link to="/worlds" className="text-blue-600 hover:underline">
          My Worlds
        </Link>
        <Link to="/about" className="text-blue-600 hover:underline">
          About
        </Link>
      </nav>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-4">
            <p className="text-gray-700">
              Signed in as <span className="font-medium">{user?.email}</span>
            </p>
            <button
              onClick={() => logout()}
              className="text-sm text-red-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <p className="text-gray-600">Not signed in</p>
            <Link to="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
            <Link to="/register" className="text-blue-600 hover:underline">
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

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
    return <div className="p-8 text-gray-600">Loading world...</div>
  }

  if (error || !world) {
    return (
      <div className="p-8" data-testid="error">
        <h1 className="text-2xl font-bold text-red-600">World not found</h1>
        <p className="mt-2 text-gray-600">The world you're looking for doesn't exist or has been deleted.</p>
        <Link to="/worlds" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to My Worlds
        </Link>
      </div>
    )
  }

  return (
    <EditorShell worldId={worldId}>
      <MapCanvas className="absolute inset-0" showMockFeatures={false} seed={world.seed} />
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
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/worlds"
        element={
          <ProtectedRoute>
            <WorldsPage />
          </ProtectedRoute>
        }
      />
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
