"""FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="City Doodle API",
    description="Backend API for City Doodle - a lo-fi vector city builder",
    version="0.1.0",
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "city-api"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
