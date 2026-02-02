import { Routes, Route, Link } from 'react-router-dom'

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-900">City Doodle</h1>
      <p className="mt-2 text-gray-600">A lo-fi vector city builder</p>
      <nav className="mt-4">
        <Link to="/about" className="text-blue-600 hover:underline">
          About
        </Link>
      </nav>
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
      <Route path="/about" element={<About />} />
    </Routes>
  )
}
