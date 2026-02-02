# Deployment Guide

This guide covers deploying City Doodle to production.

## Architecture

| App | Platform | URL Pattern |
|-----|----------|-------------|
| Web | Vercel | `city-doodle.vercel.app` |
| API | Fly.io | `city-doodle-api.fly.dev` |
| Worker | Fly.io | (internal, no public URL) |

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) (`brew install flyctl`)
- Neon Postgres database provisioned

## Web App (Vercel)

### First-time Setup

```bash
cd apps/web
vercel link
```

### Environment Variables

Set these in Vercel dashboard or via CLI:

```bash
vercel env add VITE_API_URL production
# Enter: https://city-doodle-api.fly.dev
```

### Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## API (Fly.io)

### First-time Setup

```bash
cd apps/api
fly launch --no-deploy
# Use existing fly.toml when prompted
```

### Secrets

```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set CORS_ORIGINS="https://city-doodle.vercel.app"
```

### Deploy

```bash
fly deploy
```

### Health Check

```bash
curl https://city-doodle-api.fly.dev/health
# Expected: {"status":"healthy"}
```

## Worker (Fly.io)

### First-time Setup

```bash
cd apps/worker
fly launch --no-deploy
# Use existing fly.toml when prompted
```

### Secrets

```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set REDIS_URL="redis://..."
```

### Deploy

```bash
fly deploy
```

### Monitoring

```bash
fly logs
fly status
```

## Database (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Set as `DATABASE_URL` secret in both API and Worker

## CI/CD (Future)

GitHub Actions workflows can automate deployments:

- **Web**: Vercel GitHub integration (auto-deploys on push)
- **API/Worker**: `fly deploy` in GitHub Actions on main branch

## Rollback

### Vercel

```bash
vercel rollback
```

### Fly.io

```bash
fly releases
fly deploy --image <previous-image>
```
