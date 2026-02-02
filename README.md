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

# Install Python packages in development mode
pip install -e .
pip install -e apps/api
pip install -e apps/worker
pip install -e packages/shared
```

### Running the Apps

```bash
# Web app (development server)
npm run dev

# API server
cd apps/api && uvicorn city_api.main:app --reload

# Worker
python -m city_worker.main
```

## Development

See [CLAUDE.md](./CLAUDE.md) for development workflows and AI agent instructions.
