# City Doodle

A lo-fi vector city builder — a lightweight planning sim disguised as a map doodle.

## Architecture

```
city-doodle/
├── apps/
│   ├── web/          # React + TypeScript + Vite frontend
│   ├── api/          # FastAPI backend
│   └── worker/       # Python worker for heavy generation tasks
├── packages/
│   └── shared/       # Shared TypeScript types + Python schemas
├── lib/              # Development tooling (vibe CLI)
└── recipes/          # Development workflow guides
```

### Tech Stack

- **Frontend**: React + TypeScript + PixiJS (WebGL) for clean vector rendering
- **Backend**: FastAPI (Python) with separate worker process for heavy generation
- **Database**: Postgres (Neon)
- **Deployment**: Vercel (web app), Fly.io (API + worker)

## Getting Started

### Prerequisites

- Node.js >= 18
- Python >= 3.11
- npm (comes with Node.js)

### Installation

```bash
# Install Node dependencies (web app + shared types)
npm install

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python packages in development mode
pip install -e ".[dev]"
pip install -e "apps/api[dev]"
pip install -e apps/worker
pip install -e packages/shared
```

### Running the Apps

```bash
# Web app (development server)
npm run dev

# API server (activate venv first)
source .venv/bin/activate
uvicorn city_api.main:app --reload --app-dir apps/api/src

# Worker
source .venv/bin/activate
python -m city_worker.main
```

### Running Tests

```bash
# Python tests (API)
source .venv/bin/activate
pytest apps/api/tests -v

# TypeScript tests (Web)
npm test --workspace=apps/web
```

## Development

See [CLAUDE.md](./CLAUDE.md) for development workflows and AI agent instructions.
