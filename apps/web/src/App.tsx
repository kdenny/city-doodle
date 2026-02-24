import { lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CityLoader } from './components/ui'

// Route-level code splitting: each page is loaded on demand so that
// login/register never pull in PixiJS, MapCanvas, or EditorShell.
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage }))
)
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
)
const WorldsPage = lazy(() =>
  import('./pages/WorldsPage').then((m) => ({ default: m.WorldsPage }))
)
const WorldEditorPage = lazy(() =>
  import('./pages/WorldEditorPage').then((m) => ({ default: m.WorldEditorPage }))
)

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
    <Suspense fallback={<CityLoader variant="page" />}>
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
              <WorldEditorPage />
            </ProtectedRoute>
          }
        />
        <Route path="/about" element={<About />} />
      </Routes>
    </Suspense>
  )
}
