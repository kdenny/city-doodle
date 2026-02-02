import { Routes, Route, Link } from 'react-router-dom'
import { MapCanvas } from './components/canvas'

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-900">City Doodle</h1>
      <p className="mt-2 text-gray-600">A lo-fi vector city builder</p>
      <nav className="mt-4 flex gap-4">
        <Link to="/editor" className="text-blue-600 hover:underline">
          Editor
        </Link>
        <Link to="/about" className="text-blue-600 hover:underline">
          About
        </Link>
      </nav>
    </div>
  )
}

function Editor() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="h-12 bg-gray-800 text-white flex items-center px-4 shrink-0">
        <Link to="/" className="font-bold">City Doodle</Link>
        <span className="ml-4 text-gray-400 text-sm">Editor</span>
      </header>
      <main className="flex-1 relative">
        <MapCanvas className="absolute inset-0" />
      </main>
    </div>
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
      <Route path="/editor" element={<Editor />} />
      <Route path="/about" element={<About />} />
    </Routes>
  )
}
