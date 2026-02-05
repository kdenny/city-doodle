# AI Agent Instructions
# Format: GitHub Copilot
# Generated: 2026-02-04
# Source: agent_instructions/
#
# DO NOT EDIT DIRECTLY - regenerate with: bin/vibe generate-agent-instructions


# Copilot Instructions

## About This Project

This is **(your project name)**.
(what this project does)

## Technology Stack

- **Backend**: (e.g., FastAPI, Django, Express)
- **Frontend**: (e.g., React, Next.js, Vue)
- **Database**: (e.g., PostgreSQL, Supabase, Neon)
- **Deployment**: (e.g., Vercel, Fly.io, AWS)

## Coding Guidelines

Follow these guidelines when generating code:

- Read files before modifying them - understand existing code before making changes
- Use existing patterns - match the codebase's style, naming conventions, and architecture
- Prefer editing over creating - modify existing files rather than creating new ones
- Keep changes minimal - only change what's necessary to complete the task
- No security vulnerabilities - avoid XSS, SQL injection, command injection, etc.
- Handle errors gracefully - don't leave code in broken states
- Test your changes - verify code works before marking task complete
- Document non-obvious code - add comments only where the logic isn't self-evident

## Patterns to Avoid

- Guessing file contents without reading them first
- Creating new abstractions for one-time operations
- Adding features, refactoring, or "improvements" beyond what was asked
- Over-engineering with unnecessary complexity
- Leaving console.log or debug statements in production code
- Ignoring existing error handling patterns
- Making assumptions about requirements without asking
- Committing secrets, API keys, or credentials

## Key Files

- ``CLAUDE.md` - AI agent instructions (this generated file)`
- ``.vibe/config.json` - Project configuration`
- ``README.md` - Project documentation`
- ``.env.example` - Environment variable template`

## CLI Commands

Use these commands for common operations:

- `bin/vibe doctor` - Check project health and configuration.
- `bin/vibe setup` - Run the setup wizard to configure your project.
- `bin/vibe do <ticket-id>` - Start working on a ticket (creates worktree and branch).
- `bin/ticket list` - List tickets from the tracker.
- `bin/ticket get <ticket-id>` - Get details for a specific ticket.
- `bin/ticket create "<title>"` - Create a new ticket.
- `bin/ticket link <blocker-id> <blocked-id>` - Create or remove blocking relationships between tickets.
- `bin/ticket relations <ticket-id>` - Show blocking relationships for a ticket.
- `bin/vibe pr` - Create a pull request for the current branch.
- `bin/vibe figma analyze` - Analyze frontend codebase for design system context.
- `bin/vibe generate-agent-instructions` - Generate assistant-specific instruction files.
